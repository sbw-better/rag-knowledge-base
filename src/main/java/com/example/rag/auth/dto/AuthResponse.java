package com.example.rag.auth.dto;

/**
 * 登录或注册成功后的认证响应。
 */
public record AuthResponse(String token, UserResponse user) {
}
