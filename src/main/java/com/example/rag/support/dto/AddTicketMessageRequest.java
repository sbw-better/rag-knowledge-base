package com.example.rag.support.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 工单沟通消息请求。
 */
public record AddTicketMessageRequest(@NotBlank String content) {
}
