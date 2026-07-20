package com.example.rag.document;

import com.example.rag.audit.AuditLogService;
import com.example.rag.auth.CurrentUser;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.NotFoundException;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentStatus;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.domain.UserAccount;
import com.example.rag.document.dto.DocumentItem;
import com.example.rag.document.dto.DocumentChunkResponse;
import com.example.rag.document.dto.DocumentResponse;
import com.example.rag.document.dto.TaskResponse;
import com.example.rag.document.dto.UploadResponse;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.MessageCitationMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.retrieval.VectorIndexService;
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

    public DocumentService(KnowledgeBaseService knowledgeBaseService,
                           DocumentMapper documentMapper,
                           DocumentChunkMapper chunkMapper,
                           RagTaskMapper taskMapper,
                            MessageCitationMapper citationMapper,
                            VectorIndexService vectorIndexService,
                            StorageService storageService,
                            AppProperties properties,
                            AuditLogService auditLogService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.documentMapper = documentMapper;
        this.chunkMapper = chunkMapper;
        this.taskMapper = taskMapper;
        this.citationMapper = citationMapper;
        this.vectorIndexService = vectorIndexService;
        this.storageService = storageService;
        this.properties = properties;
        this.auditLogService = auditLogService;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentMapper documentMapper;
    private final DocumentChunkMapper chunkMapper;
    private final RagTaskMapper taskMapper;
    private final MessageCitationMapper citationMapper;
    private final VectorIndexService vectorIndexService;
    private final StorageService storageService;
    private final AppProperties properties;
    private final AuditLogService auditLogService;

    @Transactional
    public UploadResponse upload(Long knowledgeBaseId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("请选择要上传的文件");
        }
        String safeFileName = sanitizeFileName(file.getOriginalFilename());
        validateFile(safeFileName);
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireContentManageAccess(knowledgeBaseId);
        log.info("收到文档上传请求。tenantId={}, userId={}, knowledgeBaseId={}, fileName={}, sizeBytes={}",
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
        log.info("文档上传已受理，已创建入库任务。documentId={}, taskId={}, objectKey={}",
                document.getId(), task.getId(), document.getObjectKey());
        auditLogService.record(user, "DOCUMENT_UPLOAD", "DOCUMENT", document.getId(),
                "上传文档：" + document.getFileName() + "，入库任务：" + task.getId());
        return new UploadResponse(toResponse(document), toResponse(task));
    }

    /**
     * 查询单个文档详情。先按租户查文档，再复用知识库权限校验，避免越权查看。
     */
    public DocumentResponse get(Long id) {
        UserAccount user = CurrentUser.required();
        DocumentEntity document = documentMapper.selectByIdAndTenantId(id, user.getTenantId());
        if (document == null) {
            throw new NotFoundException("文档不存在");
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
        log.debug("查询知识库文档列表完成。tenantId={}, userId={}, knowledgeBaseId={}, count={}",
                user.getTenantId(), user.getId(), knowledgeBaseId, documents.size());
        return documents;
    }

    public PageResponse<DocumentItem> listByKnowledgeBase(Long knowledgeBaseId, PageRequestParams params) {
        UserAccount user = CurrentUser.required();
        knowledgeBaseService.requireContentManageAccess(knowledgeBaseId);
        long total = documentMapper.countByKnowledgeBaseIdAndTenantId(knowledgeBaseId, user.getTenantId(), params.keyword());
        List<DocumentItem> documents = documentMapper.selectPageByKnowledgeBaseIdAndTenantId(
                        knowledgeBaseId, user.getTenantId(), params.keyword(), params.pageSize(), params.offset())
                .stream()
                .map(document -> new DocumentItem(
                        toResponse(document),
                        toResponseOrNull(taskMapper.selectLatestByDocumentId(document.getId()))))
                .toList();
        log.debug("分页查询知识库文档完成。tenantId={}, userId={}, knowledgeBaseId={}, page={}, pageSize={}, total={}",
                user.getTenantId(), user.getId(), knowledgeBaseId, params.page(), params.pageSize(), total);
        return PageResponse.of(documents, params.page(), params.pageSize(), total);
    }

    public TaskResponse getTask(Long id) {
        UserAccount user = CurrentUser.required();
        RagTask task = taskMapper.selectByIdAndTenantId(id, user.getTenantId());
        if (task == null) {
            throw new NotFoundException("任务不存在");
        }
        return toResponse(task);
    }

    /**
     * 查看某个文档解析后的切片列表。
     *
     * <p>切片内容属于知识库维护信息，只允许具备内容维护权限的用户查看。</p>
     */
    public List<DocumentChunkResponse> listChunks(Long id) {
        DocumentEntity document = requireDocument(id);
        knowledgeBaseService.requireContentManageAccess(document.getKnowledgeBaseId());
        return chunkMapper.selectByDocumentIdAndTenantId(document.getId(), document.getTenantId()).stream()
                .map(this::toChunkResponse)
                .toList();
    }

    /**
     * 重新创建文档入库任务。
     *
     * <p>旧切片会在 Worker 真正处理任务时先清理，这样如果任务还没执行，现有可用索引仍能暂时保留。</p>
     */
    @Transactional
    public TaskResponse reingest(Long id) {
        UserAccount user = CurrentUser.required();
        DocumentEntity document = requireDocument(id);
        knowledgeBaseService.requireContentManageAccess(document.getKnowledgeBaseId());
        document.setStatus(DocumentStatus.UPLOADED);
        document.setErrorMessage(null);
        documentMapper.updateById(document);

        RagTask task = new RagTask();
        task.setTenantId(user.getTenantId());
        task.setDocumentId(document.getId());
        task.setDocument(document);
        task.setType(TaskType.INGEST_DOCUMENT);
        task.setStatus(TaskStatus.PENDING);
        task.setMaxAttempts(properties.ingestion().maxAttempts());
        taskMapper.insert(task);
        log.info("文档重新入库任务已创建。tenantId={}, userId={}, documentId={}, taskId={}",
                user.getTenantId(), user.getId(), document.getId(), task.getId());
        auditLogService.record(user, "DOCUMENT_REINGEST", "DOCUMENT", document.getId(),
                "重新入库文档：" + document.getFileName() + "，入库任务：" + task.getId());
        return toResponse(task);
    }

    /**
     * 删除文档及其检索索引。
     *
     * <p>项目约定 MySQL 不使用外键，所以删除文档时必须由业务代码显式清理关联数据。
     * 清理顺序是：回答引用、Milvus 向量、MySQL 切片、入库任务、文档元数据、MinIO 原文件。
     * 其中 Milvus 是外部索引，删除失败会抛出异常阻止后续 MySQL 删除，避免出现“数据库没了但向量还在”的状态。</p>
     */
    @Transactional
    public void delete(Long id) {
        UserAccount user = CurrentUser.required();
        DocumentEntity document = requireDocument(id);
        knowledgeBaseService.requireContentManageAccess(document.getKnowledgeBaseId());
        citationMapper.deleteByDocumentId(document.getId());
        vectorIndexService.deleteVectorIndexByDocument(document.getId());
        int deletedChunks = chunkMapper.deleteByDocumentId(document.getId());
        int deletedTasks = taskMapper.deleteByDocumentId(document.getId());
        int deleted = documentMapper.deleteByIdAndTenantId(document.getId(), document.getTenantId());
        if (deleted == 0) {
            throw new NotFoundException("文档不存在");
        }
        storageService.deleteQuietly(document.getObjectKey());
        log.info("文档已删除。tenantId={}, userId={}, knowledgeBaseId={}, documentId={}, deletedChunks={}, deletedTasks={}",
                user.getTenantId(), user.getId(), document.getKnowledgeBaseId(), document.getId(), deletedChunks, deletedTasks);
        auditLogService.record(user, "DOCUMENT_DELETE", "DOCUMENT", document.getId(),
                "删除文档：" + document.getFileName());
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

    private DocumentChunkResponse toChunkResponse(DocumentChunk chunk) {
        return new DocumentChunkResponse(
                chunk.getId().toString(),
                chunk.getDocumentId().toString(),
                chunk.getChunkIndex(),
                chunk.getContent(),
                chunk.getMetadataJson(),
                chunk.getCreatedAt());
    }

    private TaskResponse toResponseOrNull(RagTask task) {
        return task == null ? null : toResponse(task);
    }

    private DocumentEntity requireDocument(Long id) {
        UserAccount user = CurrentUser.required();
        DocumentEntity document = documentMapper.selectByIdAndTenantId(id, user.getTenantId());
        if (document == null) {
            throw new NotFoundException("文档不存在");
        }
        return document;
    }

    private void validateFile(String fileName) {
        String name = fileName == null ? "" : fileName.toLowerCase();
        if (!(name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt")
                || name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".html")
                || name.endsWith(".htm"))) {
            throw new BadRequestException("不支持的文件类型");
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
