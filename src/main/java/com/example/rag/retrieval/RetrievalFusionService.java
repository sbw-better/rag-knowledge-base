package com.example.rag.retrieval;

import com.example.rag.config.AppProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RetrievalFusionService {
    private final AppProperties properties;

    public List<SearchCandidate> fuse(List<SearchCandidate> vectorHits, List<SearchCandidate> keywordHits, int topK) {
        Map<UUID, MutableHit> merged = new LinkedHashMap<>();
        add(merged, vectorHits, properties.retrieval().vectorWeight(), "VECTOR");
        add(merged, keywordHits, properties.retrieval().keywordWeight(), "KEYWORD");
        return merged.values().stream()
                .map(MutableHit::toCandidate)
                .sorted(Comparator.comparingDouble(SearchCandidate::score).reversed())
                .limit(topK)
                .toList();
    }

    private static void add(Map<UUID, MutableHit> merged, List<SearchCandidate> hits, double weight, String source) {
        for (int i = 0; i < hits.size(); i++) {
            SearchCandidate hit = hits.get(i);
            MutableHit mutable = merged.computeIfAbsent(hit.chunkId(), key -> new MutableHit(hit));
            mutable.score += weight * (1.0 / (60 + i + 1));
            mutable.source = mutable.source.equals(source) ? source : "HYBRID";
        }
    }

    private static class MutableHit {
        private final SearchCandidate hit;
        private double score;
        private String source;

        MutableHit(SearchCandidate hit) {
            this.hit = hit;
            this.source = hit.source();
        }

        SearchCandidate toCandidate() {
            return new SearchCandidate(hit.chunkId(), hit.documentId(), hit.fileName(), hit.chunkIndex(),
                    hit.content(), score, source);
        }
    }
}
