package com.example.rag.document.dto;

/**
 * 任务中心列表项。
 *
 * <p>task 是原始任务响应，knowledgeBaseName/documentFileName 用于列表展示和快速定位。</p>
 */
public record TaskListItem(
        TaskResponse task,
        String knowledgeBaseName,
        String documentFileName
) {
}
