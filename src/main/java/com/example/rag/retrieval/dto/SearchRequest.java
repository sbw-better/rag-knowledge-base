package com.example.rag.retrieval.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * 检索请求。
 *
 * <p>该请求主要用于维护者调试召回效果。mode 决定使用向量、关键词或混合检索；
 * topK 是一次请求的临时覆盖值，不传时使用知识库默认 topK。</p>
 */
public record SearchRequest(
        @NotNull UUID knowledgeBaseId,
        @NotBlank String query,
        SearchMode mode,
        @Min(1) @Max(50) Integer topK
) {
}
