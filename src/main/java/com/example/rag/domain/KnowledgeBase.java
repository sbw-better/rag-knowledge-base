package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 知识库实体。
 *
 * <p>知识库是业务资料的隔离单元。一个知识库通常对应一个业务场景，例如客服知识库、
 * 医疗服务知识库、产品手册知识库。文档、切片、检索、问答都通过 knowledgeBaseId 归属到这里。</p>
 */
@TableName("knowledge_bases")
public class KnowledgeBase {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long tenantId;
    private Long ownerId;
    private String name;
    private String description;

    /**
     * 文档入库时的默认切片长度。修改后只影响后续新上传或重新入库的文档。
     */
    private int chunkSize = 800;

    /**
     * 相邻切片之间保留的重叠字符数，用于减少语义在切片边界处断裂。
     */
    private int chunkOverlap = 120;

    /**
     * 检索和问答默认召回片段数量。维护者可以在设置页长期调整该值。
     */
    private int topK = 8;

    /**
     * 默认最低检索分数阈值。0 表示不过滤；大于 0 时会丢弃低于阈值的召回片段。
     *
     * <p>该值用于减少“问题不相关但仍返回来源”的情况。不同检索模式的分数含义不完全一致，
     * 所以生产环境通常需要结合真实数据逐步调参。</p>
     */
    private double minScore = 0;

    /**
     * 逻辑删除标记。删除知识库时不物理删除记录，便于审计和后续恢复策略扩展。
     */
    private boolean deleted = false;
    private Instant createdAt;
    private Instant updatedAt;

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

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public int getChunkSize() {
        return chunkSize;
    }

    public void setChunkSize(int chunkSize) {
        this.chunkSize = chunkSize;
    }

    public int getChunkOverlap() {
        return chunkOverlap;
    }

    public void setChunkOverlap(int chunkOverlap) {
        this.chunkOverlap = chunkOverlap;
    }

    public int getTopK() {
        return topK;
    }

    public void setTopK(int topK) {
        this.topK = topK;
    }

    public double getMinScore() {
        return minScore;
    }

    public void setMinScore(double minScore) {
        this.minScore = minScore;
    }

    public boolean isDeleted() {
        return deleted;
    }

    public void setDeleted(boolean deleted) {
        this.deleted = deleted;
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
