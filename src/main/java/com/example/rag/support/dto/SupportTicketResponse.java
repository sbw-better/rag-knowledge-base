package com.example.rag.support.dto;

import com.example.rag.domain.SupportTicketPriority;
import com.example.rag.domain.SupportTicketStatus;

import java.time.Instant;
import java.util.List;

/**
 * 售后工单详情响应。
 */
public record SupportTicketResponse(
        String id,
        String knowledgeBaseId,
        String knowledgeBaseName,
        String assigneeId,
        String assigneeName,
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
        Instant dueAt,
        boolean overdue,
        boolean dueSoon,
        String issueSummary,
        String customerQuestion,
        String latestAiReply,
        String aiConversationId,
        Instant resolvedAt,
        Instant createdAt,
        Instant updatedAt,
        boolean canWork,
        boolean canClose,
        boolean canReopen,
        List<SupportTicketStatus> allowedStatuses
) {
}
