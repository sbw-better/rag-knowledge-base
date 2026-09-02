package com.example.rag.support.dto;

import jakarta.validation.constraints.NotNull;

/**
 * 创建演示售后工单请求。
 */
public record CreateDemoTicketsRequest(@NotNull String knowledgeBaseId) {
}
