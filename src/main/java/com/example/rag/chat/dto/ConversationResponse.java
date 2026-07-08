package com.example.rag.chat.dto;

import java.util.List;

/**
 * 会话详情响应。
 */
public record ConversationResponse(String id, String title, List<MessageItem> messages) {
}
