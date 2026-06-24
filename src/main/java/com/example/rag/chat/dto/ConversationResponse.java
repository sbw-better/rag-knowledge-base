package com.example.rag.chat.dto;

import java.util.List;
import java.util.UUID;

/**
 * 会话详情响应。
 */
public record ConversationResponse(UUID id, String title, List<MessageItem> messages) {
}
