package com.example.rag.support.dto;

/**
 * 售后看板每日趋势响应。
 */
public record SupportTicketTrendResponse(
        String dateLabel,
        long total,
        long resolved,
        long overdue,
        long outgoingReplies
) {
}
