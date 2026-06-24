package com.example.rag.model;

import java.util.List;

/**
 * Embedding 模型客户端抽象。
 *
 * <p>文档入库和向量检索都依赖该接口把文本转换成向量。当前实现是 OpenAI-compatible；
 * 后续切换阿里云百炼、智谱、Ollama 或本地模型时，只要新增实现并保持返回维度和数据库向量维度一致。</p>
 */
public interface EmbeddingClient {
    /**
     * 将输入文本转换为向量。
     */
    List<Double> embed(String text);
}
