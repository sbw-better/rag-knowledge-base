package com.example.rag.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ApiDtos {
    private ApiDtos() {
    }

    public record RegisterRequest(@Email @NotBlank String email, @NotBlank String password, @NotBlank String displayName) {
    }

    public record LoginRequest(@Email @NotBlank String email, @NotBlank String password) {
    }

    public record AuthResponse(String token, UserResponse user) {
    }

    public record UserResponse(UUID id, String email, String displayName, List<String> roles) {
    }

    public record KnowledgeBaseRequest(
            @NotBlank String name,
            String description,
            @Min(200) @Max(4000) Integer chunkSize,
            @Min(0) @Max(1000) Integer chunkOverlap,
            @Min(1) @Max(50) Integer topK
    ) {
    }

    public record KnowledgeBaseResponse(
            UUID id,
            String name,
            String description,
            int chunkSize,
            int chunkOverlap,
            int topK,
            Instant createdAt
    ) {
    }

    public record DocumentResponse(UUID id, UUID knowledgeBaseId, String fileName, String contentType,
                                   long sizeBytes, String status, String errorMessage, Instant createdAt) {
    }

    public record UploadResponse(DocumentResponse document, TaskResponse task) {
    }

    public record TaskResponse(UUID id, UUID documentId, String type, String status, int attempts,
                               String errorMessage, Instant createdAt, Instant finishedAt) {
    }

    public record SearchRequest(@NotNull UUID knowledgeBaseId, @NotBlank String query,
                                SearchMode mode, Integer topK) {
    }

    public enum SearchMode {
        VECTOR, KEYWORD, HYBRID
    }

    public record SearchHit(UUID chunkId, UUID documentId, String fileName, int chunkIndex,
                            String content, double score, String source) {
    }

    public record SearchResponse(List<SearchHit> hits) {
    }

    public record ChatRequest(@NotNull UUID knowledgeBaseId, UUID conversationId,
                              @NotBlank String question, Integer topK) {
    }

    public record Citation(UUID documentId, UUID chunkId, String fileName, int chunkIndex,
                           double score, String snippet) {
    }

    public record ChatResponse(UUID conversationId, UUID userMessageId, UUID assistantMessageId,
                               String answer, List<Citation> citations) {
    }

    public record ConversationResponse(UUID id, String title, List<MessageItem> messages) {
    }

    public record MessageItem(UUID id, String role, String content, Instant createdAt, List<Citation> citations) {
    }
}
