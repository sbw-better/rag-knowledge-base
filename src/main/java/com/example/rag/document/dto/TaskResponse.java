package com.example.rag.document.dto;

import java.time.Instant;

/**
 * 文档入库任务响应。
 *
 * <p>上传接口返回该对象后，前端会轮询任务状态。attempts 表示已经执行过几次，
 * errorMessage 用于展示失败原因，finishedAt 只有任务结束后才有值。</p>
 */
public record TaskResponse(
        String id,
        String documentId,
        String knowledgeBaseId,
        String type,
        String status,
        int attempts,
        int maxAttempts,
        String errorMessage,
        boolean cancelRequested,
        Instant lockedAt,
        Instant startedAt,
        Instant createdAt,
        Instant finishedAt
) {
}
