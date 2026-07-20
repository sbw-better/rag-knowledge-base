package com.example.rag.audit.dto;

import java.time.Instant;

/**
 * 审计日志前端展示 DTO。
 */
public record AuditLogResponse(
        String id,
        String tenantId,
        String userId,
        String action,
        String targetType,
        String targetId,
        String detail,
        Instant createdAt) {
}
