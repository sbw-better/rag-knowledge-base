package com.example.rag.auth.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

/**
 * 管理员更新用户系统角色请求。
 */
public record UpdateUserRolesRequest(
        @NotEmpty(message = "roles is required")
        List<String> roles
) {
}
