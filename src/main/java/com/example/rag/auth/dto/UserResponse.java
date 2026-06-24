package com.example.rag.auth.dto;

import java.util.List;
import java.util.UUID;

/**
 * 当前用户信息响应。
 */
public record UserResponse(UUID id, String email, String displayName, List<String> roles) {
}
