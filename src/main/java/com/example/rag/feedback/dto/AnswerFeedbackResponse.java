package com.example.rag.feedback.dto;

import com.example.rag.domain.FeedbackRating;

import java.time.Instant;

public record AnswerFeedbackResponse(
        String id,
        String knowledgeBaseId,
        String conversationId,
        String userMessageId,
        String assistantMessageId,
        FeedbackRating rating,
        String reason,
        String comment,
        String businessModule,
        String businessEntityId,
        Instant createdAt,
        Instant updatedAt) {
}
