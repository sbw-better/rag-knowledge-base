package com.example.rag.document.dto;

import java.time.Instant;

/**
 * 文档切片响应。
 *
 * <p>用于知识库维护人员查看文档解析后的真实切片结果，便于判断 chunk 参数是否合理。
 * 普通问答用户不需要看到该结构。</p>
 */
public record DocumentChunkResponse(
        String id,
        String documentId,
        int chunkIndex,
        String content,
        String metadataJson,
        Instant createdAt
) {
}
