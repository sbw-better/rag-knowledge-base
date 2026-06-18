package com.example.rag.repository;

import com.example.rag.domain.KnowledgeBase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface KnowledgeBaseRepository extends JpaRepository<KnowledgeBase, UUID> {
    List<KnowledgeBase> findByTenant_IdAndDeletedFalseOrderByCreatedAtDesc(UUID tenantId);

    Optional<KnowledgeBase> findByIdAndTenant_IdAndDeletedFalse(UUID id, UUID tenantId);
}
