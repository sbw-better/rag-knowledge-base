package com.example.rag.retrieval;

import com.example.rag.domain.KnowledgeBase;
import com.example.rag.dto.ApiDtos;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.model.EmbeddingClient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SearchService {
    private final KnowledgeBaseService knowledgeBaseService;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;
    private final RetrievalFusionService fusionService;

    public ApiDtos.SearchResponse search(ApiDtos.SearchRequest request) {
        KnowledgeBase kb = knowledgeBaseService.requireAccess(request.knowledgeBaseId());
        int topK = request.topK() == null ? kb.getTopK() : request.topK();
        List<SearchCandidate> hits = searchInternal(kb, request.query(), request.mode(), topK);
        return new ApiDtos.SearchResponse(hits.stream().map(SearchService::toHit).toList());
    }

    public List<SearchCandidate> searchInternal(KnowledgeBase kb, String query, ApiDtos.SearchMode mode, int topK) {
        ApiDtos.SearchMode safeMode = mode == null ? ApiDtos.SearchMode.HYBRID : mode;
        UUID tenantId = kb.getTenant().getId();
        UUID kbId = kb.getId();
        if (safeMode == ApiDtos.SearchMode.VECTOR) {
            return vectorIndexService.vectorSearch(tenantId, kbId, embeddingClient.embed(query), topK);
        }
        if (safeMode == ApiDtos.SearchMode.KEYWORD) {
            return vectorIndexService.keywordSearch(tenantId, kbId, query, topK);
        }
        List<SearchCandidate> vector = vectorIndexService.vectorSearch(tenantId, kbId, embeddingClient.embed(query), topK * 3);
        List<SearchCandidate> keyword = vectorIndexService.keywordSearch(tenantId, kbId, query, topK * 3);
        return fusionService.fuse(vector, keyword, topK);
    }

    private static ApiDtos.SearchHit toHit(SearchCandidate hit) {
        return new ApiDtos.SearchHit(hit.chunkId(), hit.documentId(), hit.fileName(), hit.chunkIndex(),
                hit.content(), hit.score(), hit.source());
    }
}
