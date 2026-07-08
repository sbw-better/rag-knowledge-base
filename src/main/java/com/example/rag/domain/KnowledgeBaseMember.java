package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 知识库成员授权实体。
 *
 * <p>当前前端还没有成员管理页面，但后端已经预留该表。知识库访问判断会同时考虑 owner、
 * ADMIN 角色和成员表记录。后续要实现“把某个知识库授权给某个普通用户”，就会写入这里。</p>
 */
@TableName("knowledge_base_members")
public class KnowledgeBaseMember {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long knowledgeBaseId;
    private Long userId;

    /**
     * 用户在该知识库下的权限级别，例如只读、编辑、管理。
     */
    private KbPermission permission;
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getKnowledgeBaseId() {
        return knowledgeBaseId;
    }

    public void setKnowledgeBaseId(Long knowledgeBaseId) {
        this.knowledgeBaseId = knowledgeBaseId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public KbPermission getPermission() {
        return permission;
    }

    public void setPermission(KbPermission permission) {
        this.permission = permission;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
