package com.example.rag.feedback.dto;

import com.example.rag.domain.KnowledgeIssueSource;
import com.example.rag.domain.KnowledgeIssueStatus;

import java.time.Instant;

public record KnowledgeIssueResponse(
        String id,
        String knowledgeBaseId,
        String conversationId,
        String userMessageId,
        String assistantMessageId,
        String feedbackId,
        String createdBy,
        KnowledgeIssueSource source,
        KnowledgeIssueStatus status,
        String question,
        String answerSummary,
        String reason,
        String comment,
        String businessModule,
        String businessEntityId,
        String resolutionNote,
        String resolvedBy,
        Instant resolvedAt,
        Instant createdAt,
        Instant updatedAt) {
}
