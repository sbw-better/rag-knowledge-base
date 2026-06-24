package com.example.rag.retrieval;

import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.repository.DocumentChunkRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 向量索引服务。
 *
 * <p>JPA 负责保存 chunk 的普通字段，Embedding 字段使用 JDBC 写入 pgvector 的
 * {@code vector} 类型。这样可以避免 JPA 对 PostgreSQL 自定义向量类型的映射复杂度，
 * 同时保留 Repository 管理实体关系的便利。</p>
 */
@Service
public class VectorIndexService {
    private static final Logger log = LoggerFactory.getLogger(VectorIndexService.class);

    public VectorIndexService(JdbcTemplate jdbcTemplate, DocumentChunkRepository chunkRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.chunkRepository = chunkRepository;
    }

    private final JdbcTemplate jdbcTemplate;
    private final DocumentChunkRepository chunkRepository;

    @Transactional
    public void deleteByDocument(UUID documentId) {
        chunkRepository.deleteByDocument_Id(documentId);
        chunkRepository.flush();
        log.debug("Deleted existing chunks before reindex. documentId={}", documentId);
    }

    /**
     * 保存单个切片及其向量。metadataJson 当前保存文件名和 chunkIndex，后续可扩展页码、
     * 标题层级、段落位置等信息。
     */
    @Transactional
    public void saveChunk(DocumentEntity document, int index, String content, String metadataJson, List<Double> embedding) {
        DocumentChunk chunk = new DocumentChunk();
        chunk.setTenant(document.getTenant());
        chunk.setKnowledgeBase(document.getKnowledgeBase());
        chunk.setDocument(document);
        chunk.setChunkIndex(index);
        chunk.setContent(content);
        chunk.setMetadataJson(metadataJson);
        chunkRepository.saveAndFlush(chunk);
        int updatedRows = jdbcTemplate.update("update document_chunks set embedding = ?::vector where id = ?",
                vectorLiteral(embedding), chunk.getId());
        if (updatedRows != 1) {
            throw new IllegalStateException("Failed to update embedding for chunk " + chunk.getId());
        }
        log.debug("Chunk indexed. documentId={}, chunkId={}, chunkIndex={}, embeddingDimensions={}",
                document.getId(), chunk.getId(), index, embedding.size());
    }

    /**
     * 使用 pgvector cosine 距离执行向量检索。返回分数为 1 - distance，越大越相似。
     */
    public List<SearchCandidate> vectorSearch(UUID tenantId, UUID knowledgeBaseId, List<Double> embedding, int topK) {
        List<SearchCandidate> hits = jdbcTemplate.query("""
                        select c.id chunk_id, c.document_id, d.file_name, c.chunk_index, c.content,
                               1 - (c.embedding <=> ?::vector) score
                        from document_chunks c
                        join documents d on d.id = c.document_id
                        where c.tenant_id = ? and c.knowledge_base_id = ? and c.embedding is not null
                        order by c.embedding <=> ?::vector
                        limit ?
                        """,
                (rs, rowNum) -> new SearchCandidate(
                        rs.getObject("chunk_id", UUID.class),
                        rs.getObject("document_id", UUID.class),
                        rs.getString("file_name"),
                        rs.getInt("chunk_index"),
                        rs.getString("content"),
                        rs.getDouble("score"),
                        "VECTOR"),
                vectorLiteral(embedding), tenantId, knowledgeBaseId, vectorLiteral(embedding), topK);
        log.debug("Vector search completed. tenantId={}, knowledgeBaseId={}, topK={}, hits={}",
                tenantId, knowledgeBaseId, topK, hits.size());
        return hits;
    }

    /**
     * 使用简单全文检索和 LIKE 兜底执行关键词检索。中文精细分词后续可迁移到
     * OpenSearch/Elasticsearch 或 PostgreSQL 中文分词扩展。
     */
    public List<SearchCandidate> keywordSearch(UUID tenantId, UUID knowledgeBaseId, String query, int topK) {
        String like = "%" + query.toLowerCase() + "%";
        List<SearchCandidate> hits = jdbcTemplate.query("""
                        select c.id chunk_id, c.document_id, d.file_name, c.chunk_index, c.content,
                               case when lower(c.content) like ? then 1.0
                                    else ts_rank_cd(to_tsvector('simple', c.content), plainto_tsquery('simple', ?))
                               end score
                        from document_chunks c
                        join documents d on d.id = c.document_id
                        where c.tenant_id = ? and c.knowledge_base_id = ?
                          and (lower(c.content) like ? or to_tsvector('simple', c.content) @@ plainto_tsquery('simple', ?))
                        order by score desc
                        limit ?
                        """,
                (rs, rowNum) -> new SearchCandidate(
                        rs.getObject("chunk_id", UUID.class),
                        rs.getObject("document_id", UUID.class),
                        rs.getString("file_name"),
                        rs.getInt("chunk_index"),
                        rs.getString("content"),
                        rs.getDouble("score"),
                        "KEYWORD"),
                like, query, tenantId, knowledgeBaseId, like, query, topK);
        log.debug("Keyword search completed. tenantId={}, knowledgeBaseId={}, topK={}, hits={}",
                tenantId, knowledgeBaseId, topK, hits.size());
        return hits;
    }

    private static String vectorLiteral(List<Double> values) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append(values.get(i));
        }
        return builder.append(']').toString();
    }
}
