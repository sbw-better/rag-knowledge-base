package com.example.rag.auth;

import com.example.rag.domain.UserAccount;
import com.example.rag.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * JWT 请求认证过滤器。
 *
 * <p>该类是 Spring Security 过滤器链中的一个过滤器。它不是项目启动时主动执行业务逻辑，
 * 而是在每个 HTTP 请求进入 Controller 之前由 Spring Security 调用一次。</p>
 *
 * <p>职责非常集中：读取 {@code Authorization: Bearer <token>} 请求头，解析 JWT 中的用户 ID，
 * 从数据库加载用户和角色，并把认证结果放入 {@link SecurityContextHolder}。之后 Controller
 * 和 Service 就不需要重复解析 token，而是通过 {@link CurrentUser} 获取当前用户。</p>
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith("Bearer ")) {
            // 没有 token 的请求继续交给后续过滤器。是否允许匿名访问由 SecurityConfig 的 URL 规则决定。
            filterChain.doFilter(request, response);
            return;
        }

        try {
            // JWT 只保存用户 ID 等最少信息；每次请求仍从数据库加载用户，便于禁用账号后立即生效。
            UUID userId = jwtService.parseUserId(header.substring(7));
            userRepository.findById(userId).filter(UserAccount::isEnabled).ifPresent(user -> {
                List<SimpleGrantedAuthority> authorities = user.getRoles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.getName()))
                        .toList();
                Authentication auth = new UsernamePasswordAuthenticationToken(user, null, authorities);
                // SecurityContext 是当前请求的安全上下文，后续业务代码会从这里读取当前登录用户。
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        } catch (Exception ignored) {
            // token 解析失败时清空上下文，不在过滤器里直接写响应，让 Spring Security 后续统一返回 401/403。
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }
}
