package com.example.rag.support.dto;

import com.example.rag.chat.dto.ChatResponse;

/**
 * 工单 AI 回复生成结果。
 */
public record TicketAssistantReplyResponse(SupportTicketResponse ticket, ChatResponse chat) {
}
