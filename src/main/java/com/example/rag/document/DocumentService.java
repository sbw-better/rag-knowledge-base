package com.example.rag.document;

import com.example.rag.auth.CurrentUser;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.NotFoundException;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.DocumentStatus;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.domain.UserAccount;
import com.example.rag.dto.ApiDtos;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.repository.DocumentRepository;
import com.example.rag.repository.RagTaskRepository;
import com.example.rag.storage.StorageService;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.Objects;
import java.util.UUID;

@Service
public class DocumentService {
    public DocumentService(KnowledgeBaseService knowledgeBaseService, DocumentRepository documentRepository, RagTaskRepository taskRepository, StorageService storageService, AppProperties properties, EntityManager entityManager) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.documentRepository = documentRepository;
        this.taskRepository = taskRepository;
        this.storageService = storageService;
        this.properties = properties;
        this.entityManager = entityManager;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentRepository documentRepository;
    private final RagTaskRepository taskRepository;
    private final StorageService storageService;
    private final AppProperties properties;
    private final EntityManager entityManager;

    @Transactional
    public ApiDtos.UploadResponse upload(UUID knowledgeBaseId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is required");
        }
        validateFile(file.getOriginalFilename());
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(knowledgeBaseId);

        DocumentEntity document = new DocumentEntity();
        document.setId(UUID.randomUUID());
        document.setTenant(user.getTenant());
        document.setKnowledgeBase(kb);
        document.setUploadedBy(user);
        document.setFileName(Objects.requireNonNullElse(file.getOriginalFilename(), "document"));
        document.setContentType(file.getContentType());
        document.setSizeBytes(file.getSize());
        document.setStatus(DocumentStatus.UPLOADED);
        document.setObjectKey(storageService.store(file, user.getTenant().getId(), document.getId()));
        entityManager.persist(document);

        RagTask task = new RagTask();
        task.setTenant(user.getTenant());
        task.setDocument(document);
        task.setType(TaskType.INGEST_DOCUMENT);
        task.setStatus(TaskStatus.PENDING);
        task.setMaxAttempts(properties.ingestion().maxAttempts());
        taskRepository.save(task);
        return new ApiDtos.UploadResponse(toResponse(document), toResponse(task));
    }

    public ApiDtos.DocumentResponse get(UUID id) {
        UserAccount user = CurrentUser.required();
        DocumentEntity document = documentRepository.findByIdAndTenant_Id(id, user.getTenant().getId())
                .orElseThrow(() -> new NotFoundException("Document not found"));
        knowledgeBaseService.requireAccess(document.getKnowledgeBase().getId());
        return toResponse(document);
    }

    public ApiDtos.TaskResponse getTask(UUID id) {
        UserAccount user = CurrentUser.required();
        return taskRepository.findByIdAndTenant_Id(id, user.getTenant().getId())
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("Task not found"));
    }

    public ApiDtos.DocumentResponse toResponse(DocumentEntity document) {
        return new ApiDtos.DocumentResponse(
                document.getId(),
                document.getKnowledgeBase().getId(),
                document.getFileName(),
                document.getContentType(),
                document.getSizeBytes(),
                document.getStatus().name(),
                document.getErrorMessage(),
                document.getCreatedAt());
    }

    public ApiDtos.TaskResponse toResponse(RagTask task) {
        return new ApiDtos.TaskResponse(
                task.getId(),
                task.getDocument().getId(),
                task.getType().name(),
                task.getStatus().name(),
                task.getAttempts(),
                task.getErrorMessage(),
                task.getCreatedAt(),
                task.getFinishedAt());
    }

    private void validateFile(String fileName) {
        String name = fileName == null ? "" : fileName.toLowerCase();
        if (!(name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt")
                || name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".html")
                || name.endsWith(".htm"))) {
            throw new BadRequestException("Unsupported file type");
        }
    }
}
