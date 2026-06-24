package com.example.rag.chat.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * RAG 问答请求。
 *
 * <p>knowledgeBaseId 指定问答使用哪个知识库；conversationId 为空时创建新会话；
 * question 是用户问题。topK 是后端预留的临时召回数量覆盖参数，当前前端普通问答页不展示，
 * 默认使用知识库设置中的 topK。</p>
 */
public record ChatRequest(
        @NotNull UUID knowledgeBaseId,
        UUID conversationId,
        @NotBlank String question,
        @Min(1) @Max(50) Integer topK
) {
}
