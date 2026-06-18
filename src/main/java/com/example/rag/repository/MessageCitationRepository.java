package com.example.rag.repository;

import com.example.rag.domain.MessageCitation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MessageCitationRepository extends JpaRepository<MessageCitation, UUID> {
    List<MessageCitation> findByMessage_Id(UUID messageId);
}
