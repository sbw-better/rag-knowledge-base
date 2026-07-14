package com.example.rag.retrieval.dto;

/**
 * 知识库向量索引重建结果。
 *
 * <p>重建索引会保留 MySQL 中的文档切片事实数据，只删除并重写 Milvus 中的向量索引。</p>
 */
public record RebuildIndexResponse(
        String knowledgeBaseId,
        int chunkCount,
        int rebuiltCount
) {
}
