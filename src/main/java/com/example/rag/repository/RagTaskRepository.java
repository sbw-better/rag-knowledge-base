package com.example.rag.repository;

import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RagTaskRepository extends JpaRepository<RagTask, UUID> {
    Optional<RagTask> findByIdAndTenant_Id(UUID id, UUID tenantId);

    @Query("select t from RagTask t where t.status = ?1 and t.attempts < t.maxAttempts order by t.createdAt asc")
    List<RagTask> findRunnable(TaskStatus status, Pageable pageable);
}
