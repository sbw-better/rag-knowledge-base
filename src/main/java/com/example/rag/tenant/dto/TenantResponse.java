package com.example.rag.tenant.dto;

import java.time.Instant;

/**
 * 管理端租户列表响应。
 *
 * <p>用户数和知识库数用于帮助管理员理解每个租户的使用规模；MySQL 仍然是租户事实数据来源。</p>
 */
public record TenantResponse(
        String id,
        String name,
        long userCount,
        long knowledgeBaseCount,
        Instant createdAt
) {
}
