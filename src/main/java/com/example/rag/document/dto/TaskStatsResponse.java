package com.example.rag.document.dto;

/**
 * 当前知识库任务中心统计。
 */
public record TaskStatsResponse(
        long total,
        long pending,
        long running,
        long succeeded,
        long failed,
        long cancelled,
        long cancelRequested,
        long ingestDocument,
        long rebuildKnowledgeBaseIndex,
        long averageDurationMs,
        long maxDurationMs
) {
}
