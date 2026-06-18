package com.example.rag.repository;

import com.example.rag.domain.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {
    Optional<Conversation> findByIdAndTenant_IdAndUser_Id(UUID id, UUID tenantId, UUID userId);
}
