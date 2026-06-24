package com.example.rag.retrieval;

import com.example.rag.domain.KnowledgeBase;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.model.EmbeddingClient;
import com.example.rag.retrieval.dto.SearchHit;
import com.example.rag.retrieval.dto.SearchMode;
import com.example.rag.retrieval.dto.SearchRequest;
import com.example.rag.retrieval.dto.SearchResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * 检索应用服务。
 *
 * <p>对外暴露统一搜索入口，对内根据模式拆分为向量检索、关键词检索或混合检索。
 * ChatService 也复用 {@link #searchInternal(KnowledgeBase, String, SearchMode, int)}
 * 获取 RAG 上下文。</p>
 */
@Service
public class SearchService {
    private static final Logger log = LoggerFactory.getLogger(SearchService.class);

    public SearchService(KnowledgeBaseService knowledgeBaseService, EmbeddingClient embeddingClient, VectorIndexService vectorIndexService, RetrievalFusionService fusionService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.embeddingClient = embeddingClient;
        this.vectorIndexService = vectorIndexService;
        this.fusionService = fusionService;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;
    private final RetrievalFusionService fusionService;

    public SearchResponse search(SearchRequest request) {
        KnowledgeBase kb = knowledgeBaseService.requireAccess(request.knowledgeBaseId());
        int topK = request.topK() == null ? kb.getTopK() : request.topK();
        long startedAt = System.nanoTime();
        List<SearchCandidate> hits = searchInternal(kb, request.query(), request.mode(), topK);
        log.info("Search completed. tenantId={}, knowledgeBaseId={}, mode={}, topK={}, hits={}, costMs={}",
                kb.getTenant().getId(), kb.getId(), request.mode(), topK, hits.size(), elapsedMs(startedAt));
        return new SearchResponse(hits.stream().map(SearchService::toHit).toList());
    }

    /**
     * 执行检索并返回内部候选结构。
     *
     * <p>HYBRID 模式会分别取向量和关键词的更多候选，再通过 RRF 风格融合压缩到 topK。</p>
     */
    public List<SearchCandidate> searchInternal(KnowledgeBase kb, String query, SearchMode mode, int topK) {
        SearchMode safeMode = mode == null ? SearchMode.HYBRID : mode;
        UUID tenantId = kb.getTenant().getId();
        UUID kbId = kb.getId();
        if (safeMode == SearchMode.VECTOR) {
            return vectorIndexService.vectorSearch(tenantId, kbId, embeddingClient.embed(query), topK);
        }
        if (safeMode == SearchMode.KEYWORD) {
            return vectorIndexService.keywordSearch(tenantId, kbId, query, topK);
        }
        List<SearchCandidate> vector = vectorIndexService.vectorSearch(tenantId, kbId, embeddingClient.embed(query), topK * 3);
        List<SearchCandidate> keyword = vectorIndexService.keywordSearch(tenantId, kbId, query, topK * 3);
        return fusionService.fuse(vector, keyword, topK);
    }

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private static SearchHit toHit(SearchCandidate hit) {
        return new SearchHit(hit.chunkId(), hit.documentId(), hit.fileName(), hit.chunkIndex(),
                hit.content(), hit.score(), hit.source());
    }
}
