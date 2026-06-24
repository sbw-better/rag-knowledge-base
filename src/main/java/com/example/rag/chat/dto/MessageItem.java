package com.example.rag.chat.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 会话消息项。
 */
public record MessageItem(UUID id, String role, String content, Instant createdAt, List<Citation> citations) {
}
