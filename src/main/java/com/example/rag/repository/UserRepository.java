package com.example.rag.repository;

import com.example.rag.domain.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserAccount, UUID> {
    Optional<UserAccount> findByTenant_IdAndEmailIgnoreCase(UUID tenantId, String email);

    Optional<UserAccount> findByEmailIgnoreCase(String email);
}
