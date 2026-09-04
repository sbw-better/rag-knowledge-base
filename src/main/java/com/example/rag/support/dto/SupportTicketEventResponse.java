package com.example.rag.support.dto;

import com.example.rag.domain.SupportTicketEventType;
import com.example.rag.domain.SupportTicketStatus;

import java.time.Instant;

/**
 * 售后工单时间线响应。
 */
public record SupportTicketEventResponse(
        String id,
        String ticketId,
        String actorId,
        String actorName,
        SupportTicketEventType eventType,
        SupportTicketStatus fromStatus,
        SupportTicketStatus toStatus,
        String fromAssigneeId,
        String fromAssigneeName,
        String toAssigneeId,
        String toAssigneeName,
        String note,
        Instant createdAt
) {
}
