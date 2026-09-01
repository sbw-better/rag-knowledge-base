package com.example.rag.retrieval;

import com.example.rag.audit.AuditLogService;
import com.example.rag.auth.CurrentUser;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.domain.UserAccount;
import com.example.rag.document.dto.TaskResponse;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.model.EmbeddingClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 向量索引维护服务。
 *
 * <p>MySQL 是文档切片事实库，Milvus 是可重建索引库。当 Milvus 数据丢失、Embedding 模型切换、
 * collection 被重建或索引写入失败后，可以通过该服务从 MySQL chunk 重新生成向量并写回 Milvus。</p>
 */
@Service
public class IndexMaintenanceService {
    private static final Logger log = LoggerFactory.getLogger(IndexMaintenanceService.class);

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentChunkMapper chunkMapper;
    private final DocumentMapper documentMapper;
    private final RagTaskMapper taskMapper;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;
    private final AuditLogService auditLogService;
    private final AppProperties properties;

    public IndexMaintenanceService(KnowledgeBaseService knowledgeBaseService,
                                    DocumentChunkMapper chunkMapper,
                                    DocumentMapper documentMapper,
                                    RagTaskMapper taskMapper,
                                    EmbeddingClient embeddingClient,
                                    VectorIndexService vectorIndexService,
                                    AuditLogService auditLogService,
                                    AppProperties properties) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.chunkMapper = chunkMapper;
        this.documentMapper = documentMapper;
        this.taskMapper = taskMapper;
        this.embeddingClient = embeddingClient;
        this.vectorIndexService = vectorIndexService;
        this.auditLogService = auditLogService;
        this.properties = properties;
    }

    /**
     * 创建知识库索引重建任务。
     *
     * <p>重建动作可能需要为大量切片重新生成 embedding，HTTP 请求只负责创建任务；
     * 具体重建由 {@link IndexMaintenanceWorker} 后台调度执行。</p>
     */
    @Transactional
    public TaskResponse enqueueKnowledgeBaseRebuild(Long knowledgeBaseId) {
        UserAccount operator = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireManageAccess(knowledgeBaseId);
        RagTask task = new RagTask();
        task.setTenantId(operator.getTenantId());
        task.setKnowledgeBaseId(kb.getId());
        task.setType(TaskType.REBUILD_KNOWLEDGE_BASE_INDEX);
        task.setStatus(TaskStatus.PENDING);
        task.setMaxAttempts(properties.ingestion().maxAttempts());
        taskMapper.insert(task);
        log.info("知识库索引重建任务已创建。tenantId={}, userId={}, knowledgeBaseId={}, taskId={}",
                operator.getTenantId(), operator.getId(), kb.getId(), task.getId());
        auditLogService.record(operator, "KNOWLEDGE_BASE_INDEX_REBUILD_REQUEST", "KNOWLEDGE_BASE", kb.getId(),
                "创建知识库索引重建任务：" + task.getId());
        return toResponse(task);
    }

    void recoverTimedOutTask(Long taskId) {
        RagTask task = taskMapper.selectById(taskId);
        if (task == null || task.getStatus() != TaskStatus.RUNNING) {
            return;
        }
        String message;
        if (task.isCancelRequested()) {
            message = "索引重建已取消";
            task.setStatus(TaskStatus.CANCELLED);
            task.setLockedAt(null);
            task.setFinishedAt(Instant.now());
        } else if (task.getAttempts() >= task.getMaxAttempts()) {
            message = "索引重建任务执行超时，且已达到最大重试次数";
            task.setStatus(TaskStatus.FAILED);
            task.setFinishedAt(Instant.now());
        } else {
            message = "索引重建任务执行超时，已自动重新排队";
            task.setStatus(TaskStatus.PENDING);
            task.setLockedAt(null);
            task.setCancelRequested(false);
        }
        task.setErrorMessage(message);
        taskMapper.updateById(task);
    }

    void rebuildKnowledgeBaseTask(Long taskId) {
        RagTask task = taskMapper.selectById(taskId);
        if (task == null) {
            return;
        }
        if (task.getKnowledgeBaseId() == null) {
            failImmediately(task, "索引重建任务缺少知识库 ID");
            return;
        }
        try {
            task.setStatus(TaskStatus.RUNNING);
            task.setAttempts(task.getAttempts() + 1);
            task.setStartedAt(Instant.now());
            task.setLockedAt(Instant.now());
            task.setErrorMessage(null);
            taskMapper.updateById(task);

            RebuildSummary summary = rebuildKnowledgeBaseIndex(task);

            task.setStatus(TaskStatus.SUCCEEDED);
            task.setFinishedAt(Instant.now());
            task.setErrorMessage("已重建 " + summary.rebuiltCount() + "/" + summary.chunkCount() + " 个切片向量");
            log.info("知识库索引重建任务执行成功。taskId={}, knowledgeBaseId={}, chunks={}, rebuilt={}",
                    task.getId(), task.getKnowledgeBaseId(), summary.chunkCount(), summary.rebuiltCount());
        } catch (TaskCancelledException ex) {
            task.setStatus(TaskStatus.CANCELLED);
            task.setLockedAt(null);
            task.setFinishedAt(Instant.now());
            task.setErrorMessage(ex.getMessage());
            log.info("知识库索引重建任务已取消。taskId={}, knowledgeBaseId={}",
                    task.getId(), task.getKnowledgeBaseId());
        } catch (Throwable ex) {
            log.error("知识库索引重建任务执行失败。taskId={}, knowledgeBaseId={}, attempt={}/{}",
                    task.getId(), task.getKnowledgeBaseId(), task.getAttempts(), task.getMaxAttempts(), ex);
            task.setErrorMessage(ex.getMessage());
            task.setStatus(task.getAttempts() >= task.getMaxAttempts() ? TaskStatus.FAILED : TaskStatus.PENDING);
            if (task.getStatus() == TaskStatus.FAILED) {
                task.setFinishedAt(Instant.now());
            }
        } finally {
            taskMapper.updateById(task);
        }
    }

    private RebuildSummary rebuildKnowledgeBaseIndex(RagTask task) {
        Long knowledgeBaseId = task.getKnowledgeBaseId();
        List<DocumentChunk> chunks = chunkMapper.selectByKnowledgeBaseId(knowledgeBaseId);
        Map<Long, DocumentEntity> documentCache = new HashMap<>();

        ensureNotCancelled(task, false);
        vectorIndexService.deleteVectorIndexByKnowledgeBase(knowledgeBaseId);
        int rebuilt = 0;
        for (DocumentChunk chunk : chunks) {
            ensureNotCancelled(task, true);
            DocumentEntity document = documentCache.computeIfAbsent(chunk.getDocumentId(), documentMapper::selectById);
            if (document == null) {
                log.warn("跳过切片重建，因为关联文档不存在。chunkId={}, documentId={}",
                        chunk.getId(), chunk.getDocumentId());
                continue;
            }
            vectorIndexService.upsertExistingChunk(document, chunk, embeddingClient.embed(chunk.getContent()));
            rebuilt++;
        }

        log.info("知识库向量索引重建完成。knowledgeBaseId={}, chunks={}, rebuilt={}",
                knowledgeBaseId, chunks.size(), rebuilt);
        return new RebuildSummary(chunks.size(), rebuilt);
    }

    private void ensureNotCancelled(RagTask task, boolean indexMayBePartial) {
        RagTask latest = taskMapper.selectById(task.getId());
        if (latest != null && latest.isCancelRequested()) {
            task.setCancelRequested(true);
            String message = indexMayBePartial
                    ? "索引重建已取消，部分向量可能已重写，建议重新发起重建以恢复完整索引"
                    : "索引重建已取消";
            throw new TaskCancelledException(message);
        }
    }

    private void failImmediately(RagTask task, String message) {
        task.setStatus(TaskStatus.FAILED);
        task.setErrorMessage(message);
        task.setFinishedAt(Instant.now());
        taskMapper.updateById(task);
    }

    private static TaskResponse toResponse(RagTask task) {
        return new TaskResponse(
                task.getId().toString(),
                task.getDocumentId() == null ? null : task.getDocumentId().toString(),
                task.getKnowledgeBaseId() == null ? null : task.getKnowledgeBaseId().toString(),
                task.getType().name(),
                task.getStatus().name(),
                task.getAttempts(),
                task.getMaxAttempts(),
                task.getErrorMessage(),
                task.isCancelRequested(),
                task.getLockedAt(),
                task.getStartedAt(),
                task.getCreatedAt(),
                task.getFinishedAt());
    }

    private static class TaskCancelledException extends RuntimeException {
        TaskCancelledException(String message) {
            super(message);
        }
    }

    private record RebuildSummary(int chunkCount, int rebuiltCount) {
    }
}
