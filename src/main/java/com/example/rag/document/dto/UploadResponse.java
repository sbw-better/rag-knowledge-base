package com.example.rag.document.dto;

/**
 * 文档上传响应，包含文档元数据和对应的异步入库任务。
 */
public record UploadResponse(DocumentResponse document, TaskResponse task) {
}
