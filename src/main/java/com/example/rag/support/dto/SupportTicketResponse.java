package com.example.rag.support.dto;

import com.example.rag.domain.SupportTicketPriority;
import com.example.rag.domain.SupportTicketStatus;

import java.time.Instant;

/**
 * 售后工单详情响应。
 */
public record SupportTicketResponse(
        String id,
        String knowledgeBaseId,
        String knowledgeBaseName,
        String ticketNo,
        SupportTicketStatus status,
        SupportTicketPriority priority,
        String category,
        String channel,
        String customerName,
        String customerTier,
        String customerContact,
        String orderNo,
        String orderStatus,
        String productName,
        String productSku,
        Instant purchasedAt,
        String issueSummary,
        String customerQuestion,
        String latestAiReply,
        String aiConversationId,
        Instant resolvedAt,
        Instant createdAt,
        Instant updatedAt
) {
}
