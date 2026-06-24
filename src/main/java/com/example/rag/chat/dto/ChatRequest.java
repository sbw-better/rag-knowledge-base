package com.example.rag.chat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * RAG 问答请求。
 */
public record ChatRequest(
        @NotNull UUID knowledgeBaseId,
        UUID conversationId,
        @NotBlank String question,
        @Min(1) @Max(50) Integer topK
) {
}
