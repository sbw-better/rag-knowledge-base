package com.example.rag.support.dto;

import com.example.rag.domain.SupportTicketPriority;
import com.example.rag.domain.SupportTicketStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

/**
 * 售后工单创建/更新请求。
 */
public record SupportTicketRequest(
        @NotNull String knowledgeBaseId,
        String assigneeId,
        String ticketNo,
        SupportTicketStatus status,
        SupportTicketPriority priority,
        @NotBlank String category,
        @NotBlank String channel,
        @NotBlank String customerName,
        String customerTier,
        String customerContact,
        String orderNo,
        String orderStatus,
        String productName,
        String productSku,
        Instant purchasedAt,
        Instant dueAt,
        @NotBlank String issueSummary,
        @NotBlank String customerQuestion,
        String latestAiReply
) {
}
