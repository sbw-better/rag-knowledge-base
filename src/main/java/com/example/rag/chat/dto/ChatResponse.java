package com.example.rag.chat.dto;

import java.util.List;
import java.util.UUID;

/**
 * RAG 问答响应。
 */
public record ChatResponse(UUID conversationId, UUID userMessageId, UUID assistantMessageId,
                           String answer, List<Citation> citations) {
}
