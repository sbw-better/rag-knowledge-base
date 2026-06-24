package com.example.rag.knowledge.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 创建或更新知识库请求。
 */
public record KnowledgeBaseRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        @Min(200) @Max(4000) Integer chunkSize,
        @Min(0) @Max(1000) Integer chunkOverlap,
        @Min(1) @Max(50) Integer topK
) {
}
