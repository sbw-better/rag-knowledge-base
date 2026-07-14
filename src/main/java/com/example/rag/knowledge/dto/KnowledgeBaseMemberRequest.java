package com.example.rag.knowledge.dto;

import com.example.rag.domain.KbPermission;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * 知识库成员授权请求。
 */
public record KnowledgeBaseMemberRequest(
        @NotBlank(message = "userId is required")
        String userId,
        @NotNull(message = "permission is required")
        KbPermission permission
) {
}
