package com.example.rag.knowledge.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 知识库详情响应。
 */
public record KnowledgeBaseResponse(
        UUID id,
        String name,
        String description,
        int chunkSize,
        int chunkOverlap,
        int topK,
        Instant createdAt
) {
}
