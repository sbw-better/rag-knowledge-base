package com.example.rag.document.dto;

import java.time.Instant;

/**
 * 文档元数据响应。
 *
 * <p>不包含原始文件内容，只返回文件名、大小、处理状态和错误信息。
 * 前端根据 status 展示上传后的入库进度。</p>
 */
public record DocumentResponse(
        String id,
        String knowledgeBaseId,
        String fileName,
        String contentType,
        long sizeBytes,
        String status,
        String errorMessage,
        Instant createdAt
) {
}
