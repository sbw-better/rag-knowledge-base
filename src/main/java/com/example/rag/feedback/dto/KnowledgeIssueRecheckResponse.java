package com.example.rag.feedback.dto;

import java.time.Instant;

public record KnowledgeIssueRecheckResponse(
        String id, String issueId, String actorId, String outcome,
        String summary, int hitCount, Instant createdAt) {
}
