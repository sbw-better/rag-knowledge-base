package com.example.rag.knowledge.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 知识库详情响应。
 *
 * <p>返回给管理工作台展示知识库基础信息和默认 RAG 参数。后续做角色权限后，
 * 普通问答用户的页面可以只展示业务名称和描述，不展示 chunk/topK 等维护参数。</p>
 */
public record KnowledgeBaseResponse(
        UUID id,
        String name,
        String description,
        int chunkSize,
        int chunkOverlap,
        int topK,
        Instant createdAt
) {
}
