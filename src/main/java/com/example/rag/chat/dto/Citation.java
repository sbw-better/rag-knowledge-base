package com.example.rag.chat.dto;

/**
 * 回答引用来源。
 *
 * <p>每个 Citation 对应一次问答中被检索命中的文档切片。前端展示 fileName、chunkIndex、
 * score 和 snippet，帮助用户核验回答依据。</p>
 */
public record Citation(String documentId, String chunkId, String fileName, int chunkIndex, double score, String snippet) {
}
