package com.example.rag.retrieval;

import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.model.EmbeddingClient;
import com.example.rag.retrieval.dto.RebuildIndexResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 向量索引维护服务。
 *
 * <p>MySQL 是文档切片事实库，Milvus 是可重建索引库。当 Milvus 数据丢失、Embedding 模型切换、
 * collection 被重建或索引写入失败后，可以通过该服务从 MySQL chunk 重新生成向量并写回 Milvus。</p>
 */
@Service
public class IndexMaintenanceService {
    private static final Logger log = LoggerFactory.getLogger(IndexMaintenanceService.class);

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentChunkMapper chunkMapper;
    private final DocumentMapper documentMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;

    public IndexMaintenanceService(KnowledgeBaseService knowledgeBaseService,
                                   DocumentChunkMapper chunkMapper,
                                   DocumentMapper documentMapper,
                                   EmbeddingClient embeddingClient,
                                   VectorIndexService vectorIndexService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.chunkMapper = chunkMapper;
        this.documentMapper = documentMapper;
        this.embeddingClient = embeddingClient;
        this.vectorIndexService = vectorIndexService;
    }

    /**
     * 重建某个知识库的 Milvus 向量索引。
     *
     * <p>该操作是同步执行的管理动作，适合当前 MVP 规模。生产环境数据量增大后，应改造成异步任务，
     * 并记录重建进度、失败 chunk 和索引版本。</p>
     */
    public RebuildIndexResponse rebuildKnowledgeBase(Long knowledgeBaseId) {
        KnowledgeBase kb = knowledgeBaseService.requireManageAccess(knowledgeBaseId);
        List<DocumentChunk> chunks = chunkMapper.selectByKnowledgeBaseId(kb.getId());
        Map<Long, DocumentEntity> documentCache = new HashMap<>();

        vectorIndexService.deleteVectorIndexByKnowledgeBase(kb.getId());
        int rebuilt = 0;
        for (DocumentChunk chunk : chunks) {
            DocumentEntity document = documentCache.computeIfAbsent(chunk.getDocumentId(), documentMapper::selectById);
            if (document == null) {
                log.warn("Skip chunk because document is missing. chunkId={}, documentId={}",
                        chunk.getId(), chunk.getDocumentId());
                continue;
            }
            vectorIndexService.upsertExistingChunk(document, chunk, embeddingClient.embed(chunk.getContent()));
            rebuilt++;
        }

        log.info("Knowledge base vector index rebuilt. knowledgeBaseId={}, chunks={}, rebuilt={}",
                kb.getId(), chunks.size(), rebuilt);
        return new RebuildIndexResponse(kb.getId().toString(), chunks.size(), rebuilt);
    }
}
