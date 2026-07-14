package com.example.rag.auth.dto;

import java.time.Instant;
import java.util.List;

/**
 * 管理端用户列表响应。
 */
public record AdminUserResponse(
        String id,
        String email,
        String displayName,
        boolean enabled,
        List<String> roles,
        Instant createdAt
) {
}
