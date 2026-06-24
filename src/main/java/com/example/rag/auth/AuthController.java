package com.example.rag.auth;

import com.example.rag.common.ApiResponse;
import com.example.rag.auth.dto.AuthResponse;
import com.example.rag.auth.dto.LoginRequest;
import com.example.rag.auth.dto.RegisterRequest;
import com.example.rag.auth.dto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口入口。
 *
 * <p>Controller 只负责 HTTP 路径、请求体绑定和参数校验，不直接写认证细节。
 * 注册、登录、当前用户查询的业务规则都委托给 {@link AuthService}。返回值统一包一层
 * {@link ApiResponse}，前端 axios 响应拦截器会自动解包 data。</p>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    /**
     * 注册新用户并直接签发 JWT。
     *
     * <p>该接口在 SecurityConfig 中被配置为匿名可访问。第一个注册用户会在 Service 层自动获得
     * ADMIN 角色，后续用户默认是 USER。</p>
     */
    @PostMapping("/register")
    ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    /**
     * 使用邮箱和密码登录，成功后返回 JWT 和用户信息。
     */
    @PostMapping("/login")
    ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }

    /**
     * 返回当前登录用户。
     *
     * <p>前端进入工作台前会调用该接口校验本地 token 是否仍然有效。</p>
     */
    @GetMapping("/me")
    ApiResponse<UserResponse> me() {
        return ApiResponse.ok(authService.me());
    }
}
