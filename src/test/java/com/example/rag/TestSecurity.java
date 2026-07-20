package com.example.rag;

import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 测试用安全上下文工具。
 *
 * <p>生产代码通过 CurrentUser 从 Spring SecurityContext 中获取当前用户。
 * 服务层单元测试如果直接调用业务方法，也需要先把模拟用户放入 SecurityContext，
 * 才能覆盖真实请求下的权限判断逻辑。</p>
 */
final class TestSecurity {
    private TestSecurity() {
    }

    static UserAccount login(long userId, long tenantId, String email, String displayName, String... roleNames) {
        UserAccount user = user(userId, tenantId, email, displayName, roleNames);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null));
        return user;
    }

    static UserAccount user(long userId, long tenantId, String email, String displayName, String... roleNames) {
        UserAccount user = new UserAccount();
        user.setId(userId);
        user.setTenantId(tenantId);
        user.setEmail(email);
        user.setDisplayName(displayName);
        for (String roleName : roleNames) {
            user.getRoles().add(role(roleName));
        }
        return user;
    }

    static Role role(String name) {
        Role role = new Role();
        role.setId((long) Math.abs(name.hashCode()));
        role.setName(name);
        return role;
    }
}
