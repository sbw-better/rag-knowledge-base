package com.example.rag.knowledge.dto;

import java.time.Instant;

/**
 * 知识库成员授权响应。
 */
public record KnowledgeBaseMemberResponse(
        String id,
        String userId,
        String email,
        String displayName,
        String permission,
        Instant createdAt
) {
}
