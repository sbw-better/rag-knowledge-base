package com.example.rag.chat.dto;

import java.util.UUID;

/**
 * 回答引用来源。
 */
public record Citation(UUID documentId, UUID chunkId, String fileName, int chunkIndex, double score, String snippet) {
}
