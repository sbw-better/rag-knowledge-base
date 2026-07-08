package com.example.rag.retrieval;

public record SearchCandidate(Long chunkId, Long documentId, String fileName, int chunkIndex,
                              String content, double score, String source) {
}
