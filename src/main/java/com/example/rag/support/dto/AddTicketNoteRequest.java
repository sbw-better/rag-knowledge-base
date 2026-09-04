package com.example.rag.support.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 工单内部备注请求。
 */
public record AddTicketNoteRequest(@NotBlank String content) {
}
