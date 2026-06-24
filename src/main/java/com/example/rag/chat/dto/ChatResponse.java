package com.example.rag.chat.dto;

import java.util.List;
import java.util.UUID;

/**
 * RAG 问答响应。
 *
 * <p>同时返回会话 ID、用户消息 ID、助手消息 ID、最终答案和引用来源。
 * 前端可用 conversationId 继续追问，也可以用 citations 渲染可追溯来源。</p>
 */
public record ChatResponse(UUID conversationId, UUID userMessageId, UUID assistantMessageId,
                           String answer, List<Citation> citations) {
}
