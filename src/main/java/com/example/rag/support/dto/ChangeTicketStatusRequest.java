package com.example.rag.support.dto;

import com.example.rag.domain.SupportTicketStatus;
import jakarta.validation.constraints.NotNull;

/**
 * 工单状态变更请求。
 */
public record ChangeTicketStatusRequest(@NotNull SupportTicketStatus status, String note) {
}
