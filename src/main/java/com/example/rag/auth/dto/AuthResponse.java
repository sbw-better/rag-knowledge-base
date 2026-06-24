package com.example.rag.auth.dto;

/**
 * 登录或注册成功后的认证响应。
 *
 * <p>token 是前端后续请求放入 Authorization Bearer 的 JWT；user 用于前端展示当前用户信息和角色。</p>
 */
public record AuthResponse(String token, UserResponse user) {
}
