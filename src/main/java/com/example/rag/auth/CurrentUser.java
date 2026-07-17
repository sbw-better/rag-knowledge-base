package com.example.rag.auth;

import com.example.rag.common.ForbiddenException;
import com.example.rag.domain.UserAccount;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 当前登录用户获取工具。
 *
 * <p>在请求进入 Controller 之前，{@link JwtAuthenticationFilter} 会把解析出的
 * {@link UserAccount} 放入 Spring Security 的 {@link SecurityContextHolder}。
 * Service 层需要知道“当前是谁在操作”时，通过这个工具统一读取，避免在每个业务方法里重复解析 JWT。</p>
 *
 * <p>该类只适合在已经经过 Spring Security 认证的请求线程中使用。定时任务或异步任务没有前端用户请求，
 * 不应该直接调用 {@link #required()}，而应使用任务自身保存的租户、文档、用户等上下文信息。</p>
 */
public final class CurrentUser {
    private CurrentUser() {
    }

    /**
     * 获取当前请求的登录用户。
     *
     * @throws ForbiddenException 当前请求未认证，或安全上下文中没有 UserAccount principal。
     */
    public static UserAccount required() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserAccount user)) {
            throw new ForbiddenException("当前请求未登录或登录状态无效");
        }
        return user;
    }
}
