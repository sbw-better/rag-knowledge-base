package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 系统角色实体。
 *
 * <p>当前内置 ADMIN、KB_MANAGER 和 USER。角色只表达“平台级身份”：
 * ADMIN 可以管理租户内用户和知识库，KB_MANAGER 可以创建知识库，USER 是普通基础用户。
 * 某个知识库的负责人 owner 不是系统角色，而是 {@code knowledge_bases.owner_id} 上的资源归属；
 * 知识库内的成员权限由 {@link KnowledgeBaseMember} 表达。</p>
 */
@TableName("roles")
public class Role {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String name;
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
