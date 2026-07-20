package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.auth.UserAdminService;
import com.example.rag.auth.dto.AdminUserResponse;
import com.example.rag.auth.dto.UpdateUserRolesRequest;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import com.example.rag.mapper.RoleMapper;
import com.example.rag.mapper.UserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class UserAdminServiceTest {
    private final UserMapper userMapper = mock(UserMapper.class);
    private final RoleMapper roleMapper = mock(RoleMapper.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);
    private UserAdminService service;

    @BeforeEach
    void setUp() {
        service = new UserAdminService(userMapper, roleMapper, auditLogService);
    }

    @AfterEach
    void tearDown() {
        clearContext();
    }

    @Test
    void nonAdminCannotListUsersOrUpdateRoles() {
        TestSecurity.login(10L, 1L, "user@example.com", "普通用户", "USER");

        assertThatThrownBy(() -> service.listUsers())
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("平台管理员");
        assertThatThrownBy(() -> service.updateRoles(11L, new UpdateUserRolesRequest(List.of("KB_MANAGER"))))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("平台管理员");
        verify(userMapper, never()).selectByTenantId(any());
    }

    @Test
    void adminCanUpdateUserRolesAndUserRoleIsAlwaysKept() {
        UserAccount admin = TestSecurity.login(1L, 1L, "admin@example.com", "管理员", "USER", "ADMIN");
        UserAccount target = TestSecurity.user(2L, 1L, "manager@example.com", "知识库管理员", "USER");
        Role userRole = TestSecurity.role("USER");
        Role managerRole = TestSecurity.role("KB_MANAGER");
        when(userMapper.selectById(2L)).thenReturn(target);
        when(roleMapper.selectByName("USER")).thenReturn(userRole);
        when(roleMapper.selectByName("KB_MANAGER")).thenReturn(managerRole);

        AdminUserResponse response = service.updateRoles(2L, new UpdateUserRolesRequest(List.of("KB_MANAGER")));

        assertThat(response.roles()).containsExactlyInAnyOrder("USER", "KB_MANAGER");
        verify(userMapper).deleteUserRoles(2L);
        verify(userMapper).insertUserRole(2L, userRole.getId());
        verify(userMapper).insertUserRole(2L, managerRole.getId());
        verify(auditLogService).record(eq(admin), eq("USER_ROLE_UPDATE"), eq("USER"), eq(2L), any());
    }

    @Test
    void adminCannotRemoveOwnAdminRole() {
        TestSecurity.login(1L, 1L, "admin@example.com", "管理员", "USER", "ADMIN");
        UserAccount admin = TestSecurity.user(1L, 1L, "admin@example.com", "管理员", "USER", "ADMIN");
        when(userMapper.selectById(1L)).thenReturn(admin);

        assertThatThrownBy(() -> service.updateRoles(1L, new UpdateUserRolesRequest(List.of("USER"))))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("不能移除当前登录用户自己的 ADMIN 角色");
        verify(userMapper, never()).deleteUserRoles(1L);
    }
}
