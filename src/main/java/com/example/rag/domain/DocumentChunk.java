package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 文档切片实体。
 *
 * <p>文档解析后会被拆成多个 chunk。每个 chunk 保存文本内容、所属文档和知识库。
 * Embedding 向量不再存入 MySQL，而是写入 Milvus；MySQL 是业务事实库，Milvus 是可重建索引库。</p>
 */
@TableName("document_chunks")
public class DocumentChunk {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long tenantId;
    private Long knowledgeBaseId;
    private Long documentId;

    /**
     * 切片在原文档中的顺序，从 0 开始。引用来源会展示该索引，方便定位。
     */
    private int chunkIndex;

    /**
     * 清洗并切分后的文本片段，是检索召回和 Prompt 上下文的主要内容。
     */
    private String content;

    /**
     * 预留元数据，目前保存 fileName、chunkIndex，后续可扩展页码、标题层级、段落位置等。
     */
    private String metadataJson;
    private Instant createdAt;

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

    public Long getKnowledgeBaseId() {
        return knowledgeBaseId;
    }

    public void setKnowledgeBaseId(Long knowledgeBaseId) {
        this.knowledgeBaseId = knowledgeBaseId;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public int getChunkIndex() {
        return chunkIndex;
    }

    public void setChunkIndex(int chunkIndex) {
        this.chunkIndex = chunkIndex;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getMetadataJson() {
        return metadataJson;
    }

    public void setMetadataJson(String metadataJson) {
        this.metadataJson = metadataJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
