package com.example.rag.document.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 文档入库任务响应。
 */
public record TaskResponse(
        UUID id,
        UUID documentId,
        String type,
        String status,
        int attempts,
        String errorMessage,
        Instant createdAt,
        Instant finishedAt
) {
}
