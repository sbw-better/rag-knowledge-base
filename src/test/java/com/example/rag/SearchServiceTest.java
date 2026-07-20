package com.example.rag;

import com.example.rag.config.AppProperties;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.model.EmbeddingClient;
import com.example.rag.retrieval.RetrievalFusionService;
import com.example.rag.retrieval.SearchCandidate;
import com.example.rag.retrieval.SearchService;
import com.example.rag.retrieval.VectorIndexService;
import com.example.rag.retrieval.dto.SearchMode;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SearchServiceTest {
    @Test
    void hybridSearchFiltersOriginalRecallScoresBeforeRrfFusion() {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setTenantId(1L);
        kb.setId(2L);
        kb.setTopK(3);
        kb.setMinScore(0.15);

        KnowledgeBaseService knowledgeBaseService = mock(KnowledgeBaseService.class);
        EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
        VectorIndexService vectorIndexService = mock(VectorIndexService.class);
        RetrievalFusionService fusionService = new RetrievalFusionService(testProperties());
        SearchService searchService = new SearchService(knowledgeBaseService, embeddingClient, vectorIndexService, fusionService);

        SearchCandidate strongVectorHit = new SearchCandidate(100L, 200L, "体检说明.txt", 0, "体检当天需要空腹。", 0.32, "VECTOR");
        SearchCandidate weakVectorHit = new SearchCandidate(101L, 201L, "无关说明.txt", 0, "无关内容", 0.03, "VECTOR");

        when(embeddingClient.embed("体检前需要空腹吗")).thenReturn(List.of(0.1, 0.2));
        when(vectorIndexService.vectorSearch(eq(1L), eq(2L), anyList(), eq(9))).thenReturn(List.of(strongVectorHit, weakVectorHit));
        when(vectorIndexService.keywordSearch(eq(1L), eq(2L), eq("体检前需要空腹吗"), eq(9))).thenReturn(List.of());

        List<SearchCandidate> hits = searchService.searchInternal(kb, "体检前需要空腹吗", SearchMode.HYBRID, 3);

        assertThat(hits).extracting(SearchCandidate::chunkId).containsExactly(100L);
        assertThat(hits.get(0).score()).isPositive();
    }

    private static AppProperties testProperties() {
        return new AppProperties(
                new AppProperties.Security("secret", 60),
                new AppProperties.Storage("http://localhost:9000", "a", "b", "bucket"),
                new AppProperties.Milvus("http://localhost:19530", "default", "rag_document_chunks", false),
                new AppProperties.Model("http://localhost", "", "chat", "embedding", 1536),
                new AppProperties.Ingestion(true, 1000, 3, 1, 600000),
                new AppProperties.Retrieval(0.65, 0.35));
    }
}
