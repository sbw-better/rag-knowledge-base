package com.example.rag.feedback.dto;

import com.example.rag.domain.FeedbackRating;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AnswerFeedbackRequest(
        @NotBlank String assistantMessageId,
        String userMessageId,
        @NotNull FeedbackRating rating,
        String reason,
        String comment,
        String question,
        String businessModule,
        String businessEntityId) {
}
