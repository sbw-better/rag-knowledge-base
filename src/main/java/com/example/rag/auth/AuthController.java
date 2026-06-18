package com.example.rag.auth;

import com.example.rag.common.ApiResponse;
import com.example.rag.dto.ApiDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    ApiResponse<ApiDtos.AuthResponse> register(@Valid @RequestBody ApiDtos.RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    ApiResponse<ApiDtos.AuthResponse> login(@Valid @RequestBody ApiDtos.LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    @GetMapping("/me")
    ApiResponse<ApiDtos.UserResponse> me() {
        return ApiResponse.ok(authService.me());
    }
}
