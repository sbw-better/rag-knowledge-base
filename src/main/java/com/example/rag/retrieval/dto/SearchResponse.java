package com.example.rag.retrieval.dto;

import java.util.List;

/**
 * 检索响应。
 */
public record SearchResponse(List<SearchHit> hits) {
}
