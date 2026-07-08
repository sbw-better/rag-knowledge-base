package com.example.rag.chat.dto;

import java.time.Instant;
import java.util.List;

/**
 * 会话消息项。
 */
public record MessageItem(String id, String role, String content, Instant createdAt, List<Citation> citations) {
}
