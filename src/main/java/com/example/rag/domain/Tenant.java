package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 租户实体。
 *
 * <p>租户用于隔离不同组织的数据。MVP 阶段默认创建一个 {@code Default} 租户，
 * 但多数业务表已经保留 tenant_id，后续可以扩展为真正的多租户系统。</p>
 */
@TableName("tenants")
public class Tenant {
    public Tenant() {
    }

    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String name;
    private Instant createdAt;
    private Instant updatedAt;

    public Tenant(String name) {
        this.name = name;
    }

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

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
