package com.example.rag.retrieval;

import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.repository.DocumentChunkRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class VectorIndexService {
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
    }

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
    }

    public List<SearchCandidate> vectorSearch(UUID tenantId, UUID knowledgeBaseId, List<Double> embedding, int topK) {
        return jdbcTemplate.query("""
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
    }

    public List<SearchCandidate> keywordSearch(UUID tenantId, UUID knowledgeBaseId, String query, int topK) {
        String like = "%" + query.toLowerCase() + "%";
        return jdbcTemplate.query("""
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
