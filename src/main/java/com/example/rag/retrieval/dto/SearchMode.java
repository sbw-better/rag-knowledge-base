package com.example.rag.retrieval.dto;

/**
 * 检索模式。
 *
 * <p>VECTOR 使用问题向量和文档切片向量做相似度检索；KEYWORD 使用关键词匹配；
 * HYBRID 同时执行向量和关键词检索，再通过融合算法合并结果。维护者可用该模式对比召回效果。</p>
 */
public enum SearchMode {
    VECTOR, KEYWORD, HYBRID
}
