package com.example.rag.repository;

import com.example.rag.domain.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {
    Optional<DocumentEntity> findByIdAndTenant_Id(UUID id, UUID tenantId);

    List<DocumentEntity> findByKnowledgeBase_IdAndTenant_IdOrderByCreatedAtDesc(UUID knowledgeBaseId, UUID tenantId);
}
