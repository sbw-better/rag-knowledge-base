package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 会话消息实体。
 *
 * <p>一轮问答会产生至少两条消息：用户消息 USER 和助手消息 ASSISTANT。
 * 助手消息如果来自 RAG 问答，还会关联若干 {@link MessageCitation} 作为引用来源。</p>
 */
@TableName("messages")
public class MessageEntity {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long conversationId;
    private MessageRole role;

    /**
     * 消息正文。用户消息保存问题，助手消息保存模型回答。
     */
    private String content;

    /**
     * 预留扩展字段，可保存模型参数、token 用量、调试信息等结构化 JSON。
     */
    private String metadataJson;
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getConversationId() {
        return conversationId;
    }

    public void setConversationId(Long conversationId) {
        this.conversationId = conversationId;
    }

    public MessageRole getRole() {
        return role;
    }

    public void setRole(MessageRole role) {
        this.role = role;
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
