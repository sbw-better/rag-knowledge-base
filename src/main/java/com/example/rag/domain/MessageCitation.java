package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 回答引用来源实体。
 *
 * <p>每条助手回答会保存当次检索命中的文档片段，前端据此展示“答案来自哪些文件、哪些切片”。
 * 这让 RAG 回答具备可追溯性，用户可以核验答案依据，而不是只看到模型生成文本。</p>
 */
@TableName("message_citations")
public class MessageCitation {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long messageId;
    private Long documentId;
    private Long chunkId;
    private String fileName;
    private int chunkIndex;

    /**
     * 检索分数。不同检索模式下分数含义不同，只用于排序和相对参考。
     */
    private double score;

    /**
     * 引用片段摘要。保存摘要而不是完整 chunk，避免会话引用列表过大。
     */
    private String snippet;
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getMessageId() {
        return messageId;
    }

    public void setMessageId(Long messageId) {
        this.messageId = messageId;
    }

    public Long getDocumentId() {
        return documentId;
    }

    public void setDocumentId(Long documentId) {
        this.documentId = documentId;
    }

    public Long getChunkId() {
        return chunkId;
    }

    public void setChunkId(Long chunkId) {
        this.chunkId = chunkId;
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public int getChunkIndex() {
        return chunkIndex;
    }

    public void setChunkIndex(int chunkIndex) {
        this.chunkIndex = chunkIndex;
    }

    public double getScore() {
        return score;
    }

    public void setScore(double score) {
        this.score = score;
    }

    public String getSnippet() {
        return snippet;
    }

    public void setSnippet(String snippet) {
        this.snippet = snippet;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
