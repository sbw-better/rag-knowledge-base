package com.example.rag.repository;

import com.example.rag.domain.DocumentChunk;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DocumentChunkRepository extends JpaRepository<DocumentChunk, UUID> {
    void deleteByDocument_Id(UUID documentId);

    Optional<DocumentChunk> findByIdAndTenant_Id(UUID id, UUID tenantId);
}
