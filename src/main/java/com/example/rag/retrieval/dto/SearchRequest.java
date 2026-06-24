package com.example.rag.retrieval.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * 检索请求。
 */
public record SearchRequest(
        @NotNull UUID knowledgeBaseId,
        @NotBlank String query,
        SearchMode mode,
        @Min(1) @Max(50) Integer topK
) {
}
