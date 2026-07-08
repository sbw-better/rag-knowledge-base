package com.example.rag;

import com.example.rag.config.AppProperties;
import com.example.rag.retrieval.RetrievalFusionService;
import com.example.rag.retrieval.SearchCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RetrievalFusionServiceTest {
    @Test
    void fusesVectorAndKeywordHitsByChunkId() {
        AppProperties properties = new AppProperties(
                new AppProperties.Security("secret", 60),
                new AppProperties.Storage("http://localhost:9000", "a", "b", "bucket"),
                new AppProperties.Milvus("http://localhost:19530", "default", "rag_document_chunks", false),
                new AppProperties.Model("http://localhost", "", "chat", "embedding", 1536),
                new AppProperties.Ingestion(true, 1000, 3, 1),
                new AppProperties.Retrieval(0.65, 0.35));
        RetrievalFusionService service = new RetrievalFusionService(properties);
        Long chunkId = 1001L;
        SearchCandidate vector = new SearchCandidate(chunkId, 2001L, "a.txt", 0, "alpha", 0.9, "VECTOR");
        SearchCandidate keyword = new SearchCandidate(chunkId, vector.documentId(), "a.txt", 0, "alpha", 1.0, "KEYWORD");

        List<SearchCandidate> hits = service.fuse(List.of(vector), List.of(keyword), 5);

        assertThat(hits).hasSize(1);
        assertThat(hits.get(0).source()).isEqualTo("HYBRID");
        assertThat(hits.get(0).score()).isPositive();
    }
}
