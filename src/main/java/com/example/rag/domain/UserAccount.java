package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/**
 * 用户账号实体。
 *
 * <p>该实体既用于登录认证，也会作为 Spring Security Authentication 的 principal 放入
 * SecurityContext。业务层通过 CurrentUser 取到的当前用户就是这个对象。</p>
 */
@TableName("users")
public class UserAccount {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long tenantId;
    private String email;
    private String displayName;

    /**
     * BCrypt 哈希后的密码。数据库绝不保存明文密码。
     */
    private String passwordHash;

    /**
     * 账号启用状态。JWT 过滤器会重新查数据库并检查该字段，禁用账号后旧 token 也无法继续使用。
     */
    private boolean enabled = true;
    private Instant createdAt;
    private Instant updatedAt;

    /**
     * 系统级角色，例如 ADMIN、KB_MANAGER、USER。
     *
     * <p>这里不保存某个知识库下的 owner/viewer/editor。知识库负责人由
     * KnowledgeBase.ownerId 表达，知识库成员授权由 KnowledgeBaseMember 单独表达。</p>
     */
    @TableField(exist = false)
    private Set<Role> roles = new HashSet<>();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Set<Role> getRoles() {
        return roles;
    }

    public void setRoles(Set<Role> roles) {
        this.roles = roles;
    }
}
