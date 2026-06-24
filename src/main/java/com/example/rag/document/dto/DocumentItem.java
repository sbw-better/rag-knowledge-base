package com.example.rag.document.dto;

/**
 * 知识库文档列表项，合并文档信息和最近一次入库任务。
 */
public record DocumentItem(DocumentResponse document, TaskResponse task) {
}
