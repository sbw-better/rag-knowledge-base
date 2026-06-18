package com.example.rag.retrieval;

import java.util.UUID;

public record SearchCandidate(UUID chunkId, UUID documentId, String fileName, int chunkIndex,
                              String content, double score, String source) {
}
