package com.example.rag.retrieval;

import com.example.rag.config.AppProperties;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 检索结果融合服务。
 *
 * <p>当前采用 RRF（Reciprocal Rank Fusion）风格的轻量融合：不同检索通道按排名贡献分数，
 * 再叠加配置中的向量/关键词权重。它不依赖具体分数尺度，适合 MVP 阶段混合不同来源的召回。</p>
 */
@Service
public class RetrievalFusionService {
    private final AppProperties properties;

    public RetrievalFusionService(AppProperties properties) {
        this.properties = properties;
    }

    /**
     * 融合向量检索和关键词检索结果。
     *
     * <p>向量检索擅长语义相近，关键词检索擅长精确术语、编号、接口名。融合后可以提高召回稳定性，
     * 也是 RAG 系统里常见的第一版混合检索方案。</p>
     */
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

    /**
     * 将单个检索通道结果合并到候选池。相同 chunk 被多路召回时标记为 HYBRID。
     */
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
