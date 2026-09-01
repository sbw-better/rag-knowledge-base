package com.example.rag.domain;

/**
 * 异步任务类型。
 *
 * <p>当前只有文档入库任务，后续可扩展重建索引、批量删除、重新向量化等任务类型。</p>
 */
public enum TaskType {
    INGEST_DOCUMENT,
    REBUILD_KNOWLEDGE_BASE_INDEX
}
