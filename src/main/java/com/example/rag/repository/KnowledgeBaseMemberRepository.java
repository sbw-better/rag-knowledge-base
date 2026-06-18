package com.example.rag.repository;

import com.example.rag.domain.KnowledgeBaseMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface KnowledgeBaseMemberRepository extends JpaRepository<KnowledgeBaseMember, UUID> {
    boolean existsByKnowledgeBase_IdAndUser_Id(UUID knowledgeBaseId, UUID userId);
}
