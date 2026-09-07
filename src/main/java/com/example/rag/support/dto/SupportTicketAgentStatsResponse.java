package com.example.rag.support.dto;

/**
 * 售后坐席维度统计响应。
 */
public record SupportTicketAgentStatsResponse(
        String assigneeId,
        String assigneeName,
        long assignedTickets,
        long openTickets,
        long resolvedTickets,
        long outgoingReplies,
        Integer avgFirstResponseMinutes,
        Integer slaAttainmentRate
) {
}
