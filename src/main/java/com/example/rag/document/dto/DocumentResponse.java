package com.example.rag.document.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 文档元数据响应。
 */
public record DocumentResponse(
        UUID id,
        UUID knowledgeBaseId,
        String fileName,
        String contentType,
        long sizeBytes,
        String status,
        String errorMessage,
        Instant createdAt
) {
}
