package com.example.rag.document.dto;

import java.util.List;

/**
 * 批量任务操作请求。
 */
public record TaskBatchRequest(
        List<Long> taskIds
) {
}
