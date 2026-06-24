package com.example.rag.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 用户登录请求。
 */
public record LoginRequest(@Email @NotBlank String email, @NotBlank @Size(max = 128) String password) {
}
