package com.example.rag.chat.dto;

import java.time.Instant;

/**
 * 会话列表项响应。
 *
 * <p>列表页只需要展示会话标题和时间，完整消息内容由会话详情接口返回。</p>
 */
public record ConversationSummaryResponse(
        String id,
        String title,
        Instant createdAt,
        Instant updatedAt
) {
}
