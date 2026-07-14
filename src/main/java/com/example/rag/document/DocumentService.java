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
import com.example.rag.document.dto.DocumentItem;
import com.example.rag.document.dto.DocumentResponse;
import com.example.rag.document.dto.TaskResponse;
import com.example.rag.document.dto.UploadResponse;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * 文档应用服务，负责上传入口、文档元数据、入库任务和任务查询。
 *
 * <p>原始文件不会直接存入数据库，而是保存到 MinIO；数据库只保存文件元数据、
 * objectKey 和后续 RAG 检索所需的切片信息。上传接口只创建入库任务，真正的
 * 解析、切分和向量化由 {@code IngestionWorker} 异步完成。</p>
 */
@Service
public class DocumentService {
    private static final Logger log = LoggerFactory.getLogger(DocumentService.class);
    private static final Pattern UNSAFE_FILE_CHARS = Pattern.compile("[\\\\/:*?\"<>|\\p{Cntrl}]+");

    public DocumentService(KnowledgeBaseService knowledgeBaseService, DocumentMapper documentMapper, RagTaskMapper taskMapper, StorageService storageService, AppProperties properties) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.documentMapper = documentMapper;
        this.taskMapper = taskMapper;
        this.storageService = storageService;
        this.properties = properties;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentMapper documentMapper;
    private final RagTaskMapper taskMapper;
    private final StorageService storageService;
    private final AppProperties properties;

    @Transactional
    public UploadResponse upload(Long knowledgeBaseId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("File is required");
        }
        String safeFileName = sanitizeFileName(file.getOriginalFilename());
        validateFile(safeFileName);
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireContentManageAccess(knowledgeBaseId);
        log.info("Document upload requested. tenantId={}, userId={}, knowledgeBaseId={}, fileName={}, sizeBytes={}",
                user.getTenantId(), user.getId(), knowledgeBaseId, safeFileName, file.getSize());

        DocumentEntity document = new DocumentEntity();
        document.setTenantId(user.getTenantId());
        document.setKnowledgeBaseId(kb.getId());
        document.setUploadedBy(user.getId());
        document.setFileName(safeFileName);
        document.setContentType(file.getContentType());
        document.setSizeBytes(file.getSize());
        document.setStatus(DocumentStatus.UPLOADED);
        document.setObjectKey("pending");
        documentMapper.insert(document);
        document.setObjectKey(storageService.store(file, user.getTenantId(), document.getId(), safeFileName));
        documentMapper.updateById(document);

        RagTask task = new RagTask();
        task.setTenantId(user.getTenantId());
        task.setDocumentId(document.getId());
        task.setDocument(document);
        task.setType(TaskType.INGEST_DOCUMENT);
        task.setStatus(TaskStatus.PENDING);
        task.setMaxAttempts(properties.ingestion().maxAttempts());
        taskMapper.insert(task);
        log.info("Document upload accepted. documentId={}, taskId={}, objectKey={}",
                document.getId(), task.getId(), document.getObjectKey());
        return new UploadResponse(toResponse(document), toResponse(task));
    }

    /**
     * 查询单个文档详情。先按租户查文档，再复用知识库权限校验，避免越权查看。
     */
    public DocumentResponse get(Long id) {
        UserAccount user = CurrentUser.required();
        DocumentEntity document = documentMapper.selectByIdAndTenantId(id, user.getTenantId());
        if (document == null) {
            throw new NotFoundException("Document not found");
        }
        knowledgeBaseService.requireAccess(document.getKnowledgeBaseId());
        return toResponse(document);
    }

    public List<DocumentItem> listByKnowledgeBase(Long knowledgeBaseId) {
        UserAccount user = CurrentUser.required();
        knowledgeBaseService.requireContentManageAccess(knowledgeBaseId);
        List<DocumentItem> documents = documentMapper.selectByKnowledgeBaseIdAndTenantId(knowledgeBaseId, user.getTenantId())
                .stream()
                .map(document -> new DocumentItem(
                        toResponse(document),
                        toResponseOrNull(taskMapper.selectLatestByDocumentId(document.getId()))))
                .toList();
        log.debug("Listed documents. tenantId={}, userId={}, knowledgeBaseId={}, count={}",
                user.getTenantId(), user.getId(), knowledgeBaseId, documents.size());
        return documents;
    }

    public TaskResponse getTask(Long id) {
        UserAccount user = CurrentUser.required();
        RagTask task = taskMapper.selectByIdAndTenantId(id, user.getTenantId());
        if (task == null) {
            throw new NotFoundException("Task not found");
        }
        return toResponse(task);
    }

    public DocumentResponse toResponse(DocumentEntity document) {
        return new DocumentResponse(
                document.getId().toString(),
                document.getKnowledgeBaseId().toString(),
                document.getFileName(),
                document.getContentType(),
                document.getSizeBytes(),
                document.getStatus().name(),
                document.getErrorMessage(),
                document.getCreatedAt());
    }

    public TaskResponse toResponse(RagTask task) {
        return new TaskResponse(
                task.getId().toString(),
                task.getDocumentId().toString(),
                task.getType().name(),
                task.getStatus().name(),
                task.getAttempts(),
                task.getErrorMessage(),
                task.getCreatedAt(),
                task.getFinishedAt());
    }

    private TaskResponse toResponseOrNull(RagTask task) {
        return task == null ? null : toResponse(task);
    }

    private void validateFile(String fileName) {
        String name = fileName == null ? "" : fileName.toLowerCase();
        if (!(name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt")
                || name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".html")
                || name.endsWith(".htm"))) {
            throw new BadRequestException("Unsupported file type");
        }
    }

    private String sanitizeFileName(String originalFilename) {
        String value = Objects.requireNonNullElse(originalFilename, "document").trim();
        value = value.replace('\\', '/');
        int lastSlash = value.lastIndexOf('/');
        if (lastSlash >= 0) {
            value = value.substring(lastSlash + 1);
        }
        value = UNSAFE_FILE_CHARS.matcher(value).replaceAll("_").trim();
        if (value.isBlank() || ".".equals(value) || "..".equals(value)) {
            return "document";
        }
        if (value.length() <= 180) {
            return value;
        }
        int dot = value.lastIndexOf('.');
        if (dot > 0 && dot < value.length() - 1) {
            String extension = value.substring(dot);
            int baseLength = Math.max(1, 180 - extension.length());
            return value.substring(0, baseLength) + extension;
        }
        return value.substring(0, 180);
    }
}
