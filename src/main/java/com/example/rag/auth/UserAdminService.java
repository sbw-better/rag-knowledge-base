package com.example.rag.auth;

import com.example.rag.auth.dto.AdminUserResponse;
import com.example.rag.auth.dto.UpdateUserRolesRequest;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.NotFoundException;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import com.example.rag.mapper.RoleMapper;
import com.example.rag.mapper.UserMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 用户管理查询服务。
 *
 * <p>当前阶段先提供管理员授权知识库所需的用户列表，不开放修改用户、禁用用户等高风险操作。</p>
 */
@Service
public class UserAdminService {
    private final UserMapper userMapper;
    private final RoleMapper roleMapper;

    public UserAdminService(UserMapper userMapper, RoleMapper roleMapper) {
        this.userMapper = userMapper;
        this.roleMapper = roleMapper;
    }

    public List<AdminUserResponse> listUsers() {
        UserAccount current = CurrentUser.required();
        if (!isAdmin(current)) {
            throw new ForbiddenException("Only admin can list users");
        }
        return userMapper.selectByTenantId(current.getTenantId()).stream()
                .peek(user -> user.setRoles(new HashSet<>(userMapper.selectRolesByUserId(user.getId()))))
                .map(UserAdminService::toResponse)
                .toList();
    }

    @Transactional
    public AdminUserResponse updateRoles(Long userId, UpdateUserRolesRequest request) {
        UserAccount current = CurrentUser.required();
        if (!isAdmin(current)) {
            throw new ForbiddenException("Only admin can update user roles");
        }
        UserAccount target = userMapper.selectById(userId);
        if (target == null || !target.getTenantId().equals(current.getTenantId())) {
            throw new NotFoundException("User not found");
        }

        Set<String> names = new LinkedHashSet<>(request.roles().stream()
                .map(role -> role == null ? "" : role.trim().toUpperCase())
                .filter(role -> !role.isBlank())
                .toList());
        names.add("USER");
        if (current.getId().equals(target.getId()) && !names.contains("ADMIN")) {
            throw new BadRequestException("Cannot remove ADMIN role from current user");
        }

        List<Role> roles = names.stream().map(this::requiredRole).toList();
        userMapper.deleteUserRoles(target.getId());
        for (Role role : roles) {
            userMapper.insertUserRole(target.getId(), role.getId());
        }
        target.setRoles(new HashSet<>(roles));
        return toResponse(target);
    }

    private Role requiredRole(String name) {
        Role role = roleMapper.selectByName(name);
        if (role == null) {
            throw new BadRequestException("Unsupported role: " + name);
        }
        return role;
    }

    private static boolean isAdmin(UserAccount user) {
        return user.getRoles().stream().map(Role::getName).anyMatch("ADMIN"::equals);
    }

    private static AdminUserResponse toResponse(UserAccount user) {
        return new AdminUserResponse(
                user.getId().toString(),
                user.getEmail(),
                user.getDisplayName(),
                user.isEnabled(),
                user.getRoles().stream().map(Role::getName).sorted().toList(),
                user.getCreatedAt());
    }
}
