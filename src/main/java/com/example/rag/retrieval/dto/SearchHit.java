package com.example.rag.retrieval.dto;

import java.util.UUID;

/**
 * 检索命中的文档切片。
 *
 * <p>source 表示命中来源：VECTOR、KEYWORD 或 HYBRID。score 是相对分数，只适合在同一次检索结果中排序参考，
 * 不应跨不同检索模式直接比较。</p>
 */
public record SearchHit(
        UUID chunkId,
        UUID documentId,
        String fileName,
        int chunkIndex,
        String content,
        double score,
        String source
) {
}
