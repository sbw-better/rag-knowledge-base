package com.example.rag.retrieval;

import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.mapper.ChunkSearchRow;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.MessageCitationMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 文档切片索引服务。
 *
 * <p>升级到 MySQL + Milvus 后，这个类承担“事实数据”和“检索索引”的协调工作：
 * MySQL 保存切片文本、元数据和业务归属，Milvus 保存 dense vector 并用于语义相似性检索。
 * 因此 Milvus 可以随时从 MySQL 的 {@code document_chunks} 表重建，不作为唯一事实来源。</p>
 */
@Service
public class VectorIndexService {
    private static final Logger log = LoggerFactory.getLogger(VectorIndexService.class);

    private final DocumentChunkMapper chunkMapper;
    private final MessageCitationMapper citationMapper;
    private final MilvusVectorStore milvusVectorStore;

    public VectorIndexService(DocumentChunkMapper chunkMapper,
                              MessageCitationMapper citationMapper,
                              MilvusVectorStore milvusVectorStore) {
        this.chunkMapper = chunkMapper;
        this.citationMapper = citationMapper;
        this.milvusVectorStore = milvusVectorStore;
    }

    /**
     * 删除某个文档已有的切片和向量索引。
     *
     * <p>重入库或重新构建索引前先调用该方法，避免同一文档产生重复 chunk。历史问答的引用来源
     * 会通过 {@code message_citations.chunk_id} 指向旧切片，因此必须先删除引用记录，再删除 chunk。
     * 当前 MySQL 是主事实库，Milvus 删除失败会抛出异常，让任务进入重试流程。</p>
     */
    @Transactional
    public void deleteByDocument(Long documentId) {
        int deletedCitations = citationMapper.deleteByDocumentId(documentId);
        milvusVectorStore.deleteByDocument(documentId);
        int deleted = chunkMapper.deleteByDocumentId(documentId);
        log.debug("重建索引前已删除文档旧引用和旧切片。documentId={}, citationRows={}, chunkRows={}",
                documentId, deletedCitations, deleted);
    }

    /**
     * 只删除某个文档在 Milvus 中的向量索引，不删除 MySQL 事实数据。
     *
     * <p>文档删除流程会由 {@code DocumentService} 显式清理引用、切片、任务和文档元数据；
     * 这里仅负责外部向量库，避免重复删除导致日志和排查结果不清晰。</p>
     */
    public void deleteVectorIndexByDocument(Long documentId) {
        milvusVectorStore.deleteByDocument(documentId);
        log.debug("已删除文档在 Milvus 中的向量索引。documentId={}", documentId);
    }

    /**
     * 只删除某个知识库在 Milvus 中的索引，不删除 MySQL chunk。
     *
     * <p>该方法用于“重建向量索引”场景：MySQL 是事实库，chunk 文本必须保留；Milvus 是可重建索引，
     * 可以先清空指定知识库的向量，再按 MySQL chunk 重新生成 embedding 写入。</p>
     */
    public void deleteVectorIndexByKnowledgeBase(Long knowledgeBaseId) {
        milvusVectorStore.deleteByKnowledgeBase(knowledgeBaseId);
        log.info("已删除知识库在 Milvus 中的向量索引。knowledgeBaseId={}", knowledgeBaseId);
    }

    public void upsertExistingChunk(DocumentEntity document, DocumentChunk chunk, List<Double> embedding) {
        milvusVectorStore.upsertChunk(document, chunk, embedding);
        log.debug("已有切片向量已重建。documentId={}, chunkId={}, chunkIndex={}, embeddingDimensions={}",
                document.getId(), chunk.getId(), chunk.getChunkIndex(), embedding.size());
    }

    /**
     * 保存单个切片并写入 Milvus 向量索引。
     *
     * <p>先写 MySQL 生成雪花 chunkId，再把 chunkId 作为 Milvus 主键写入向量库。
     * 这样后续检索命中 Milvus 后，可以稳定回查 MySQL 中的切片和引用信息。</p>
     */
    @Transactional
    public void saveChunk(DocumentEntity document, int index, String content, String metadataJson, List<Double> embedding) {
        DocumentChunk chunk = new DocumentChunk();
        chunk.setTenantId(document.getTenantId());
        chunk.setKnowledgeBaseId(document.getKnowledgeBaseId());
        chunk.setDocumentId(document.getId());
        chunk.setChunkIndex(index);
        chunk.setContent(content);
        chunk.setMetadataJson(metadataJson);
        chunkMapper.insert(chunk);

        milvusVectorStore.upsertChunk(document, chunk, embedding);
        log.debug("切片已写入索引。documentId={}, chunkId={}, chunkIndex={}, embeddingDimensions={}",
                document.getId(), chunk.getId(), index, embedding.size());
    }

    /**
     * 语义向量检索。真正的相似性搜索由 Milvus 执行。
     *
     * <p>注意：Milvus REST 响应中的 BIGINT 字段可能经过 JSON number 传输而产生精度丢失。
     * 因此返回给业务层前，需要以 chunkId 回查 MySQL，并用 MySQL 中的事实数据修正 documentId、
     * chunkIndex 和 content。Milvus 在这里只作为可重建索引，不作为业务事实来源。</p>
     */
    public List<SearchCandidate> vectorSearch(Long tenantId, Long knowledgeBaseId, List<Double> embedding, int topK) {
        List<SearchCandidate> hits = milvusVectorStore.vectorSearch(tenantId, knowledgeBaseId, embedding, topK).stream()
                .map(this::normalizeVectorHit)
                .toList();
        log.debug("向量检索完成。tenantId={}, knowledgeBaseId={}, topK={}, hits={}",
                tenantId, knowledgeBaseId, topK, hits.size());
        return hits;
    }

    private SearchCandidate normalizeVectorHit(SearchCandidate hit) {
        DocumentChunk chunk = chunkMapper.selectChunkById(hit.chunkId());
        if (chunk == null) {
            log.warn("向量检索命中的切片在 MySQL 中不存在。chunkId={}, documentId={}", hit.chunkId(), hit.documentId());
            return hit;
        }
        return new SearchCandidate(
                chunk.getId(),
                chunk.getDocumentId(),
                hit.fileName(),
                chunk.getChunkIndex(),
                chunk.getContent(),
                hit.score(),
                hit.source());
    }

    /**
     * 关键词检索。第一版使用 MySQL FULLTEXT + LIKE 兜底，后续可在本方法内部切换 OpenSearch。
     */
    public List<SearchCandidate> keywordSearch(Long tenantId, Long knowledgeBaseId, String query, int topK) {
        String safeQuery = query == null ? "" : query.trim();
        if (safeQuery.isBlank()) {
            return List.of();
        }
        String like = "%" + safeQuery.toLowerCase() + "%";
        List<SearchCandidate> hits = chunkMapper.keywordSearch(tenantId, knowledgeBaseId, safeQuery, like, topK)
                .stream()
                .map(VectorIndexService::toCandidate)
                .toList();
        log.debug("关键词检索完成。tenantId={}, knowledgeBaseId={}, topK={}, hits={}",
                tenantId, knowledgeBaseId, topK, hits.size());
        return hits;
    }

    private static SearchCandidate toCandidate(ChunkSearchRow row) {
        return new SearchCandidate(
                row.getChunkId(),
                row.getDocumentId(),
                row.getFileName(),
                row.getChunkIndex(),
                row.getContent(),
                row.getScore(),
                "KEYWORD");
    }
}
