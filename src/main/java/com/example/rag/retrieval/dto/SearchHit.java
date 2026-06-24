package com.example.rag.retrieval.dto;

import java.util.UUID;

/**
 * 检索命中的文档切片。
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
