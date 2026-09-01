package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.PageRequestParams;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.DocumentStatus;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.domain.UserAccount;
import com.example.rag.document.DocumentService;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.MessageCitationMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.mapper.TaskListRow;
import com.example.rag.mapper.TaskStatsRow;
import com.example.rag.retrieval.VectorIndexService;
import com.example.rag.storage.StorageService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class DocumentServiceConsistencyTest {
    private final KnowledgeBaseService knowledgeBaseService = mock(KnowledgeBaseService.class);
    private final DocumentMapper documentMapper = mock(DocumentMapper.class);
    private final DocumentChunkMapper chunkMapper = mock(DocumentChunkMapper.class);
    private final RagTaskMapper taskMapper = mock(RagTaskMapper.class);
    private final MessageCitationMapper citationMapper = mock(MessageCitationMapper.class);
    private final VectorIndexService vectorIndexService = mock(VectorIndexService.class);
    private final StorageService storageService = mock(StorageService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    private DocumentService documentService;

    @BeforeEach
    void setUp() {
        documentService = new DocumentService(
                knowledgeBaseService,
                documentMapper,
                chunkMapper,
                taskMapper,
                citationMapper,
                vectorIndexService,
                storageService,
                testProperties(),
                auditLogService);
    }

    @AfterEach
    void tearDown() {
        clearContext();
    }

    @Test
    void deleteDocumentCleansCitationsVectorsChunksTasksMetadataAndObject() {
        UserAccount user = TestSecurity.login(10L, 1L, "editor@example.com", "资料维护", "USER");
        DocumentEntity document = new DocumentEntity();
        document.setId(100L);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(200L);
        document.setFileName("policy.md");
        document.setObjectKey("1/100/policy.md");
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(200L);
        kb.setTenantId(1L);
        kb.setOwnerId(10L);
        when(documentMapper.selectByIdAndTenantId(100L, 1L)).thenReturn(document);
        when(knowledgeBaseService.requireContentManageAccess(200L)).thenReturn(kb);
        when(chunkMapper.deleteByDocumentId(100L)).thenReturn(2);
        when(taskMapper.deleteByDocumentId(100L)).thenReturn(1);
        when(documentMapper.deleteByIdAndTenantId(100L, 1L)).thenReturn(1);

        documentService.delete(100L);

        verify(citationMapper).deleteByDocumentId(100L);
        verify(vectorIndexService).deleteVectorIndexByDocument(100L);
        verify(chunkMapper).deleteByDocumentId(100L);
        verify(taskMapper).deleteByDocumentId(100L);
        verify(documentMapper).deleteByIdAndTenantId(100L, 1L);
        verify(storageService).deleteQuietly("1/100/policy.md");
        verify(auditLogService).record(eq(user), eq("DOCUMENT_DELETE"), eq("DOCUMENT"), eq(100L), any());
    }

    @Test
    void retryFailedTaskRequeuesTaskAndResetsDocumentError() {
        UserAccount user = TestSecurity.login(11L, 1L, "editor@example.com", "资料维护", "USER");
        DocumentEntity document = new DocumentEntity();
        document.setId(300L);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(400L);
        document.setFileName("manual.md");
        document.setStatus(DocumentStatus.FAILED);
        document.setErrorMessage("embedding failed");
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(400L);
        RagTask task = failedTask(200L, 300L);
        when(taskMapper.selectByIdAndTenantId(200L, 1L)).thenReturn(task);
        when(documentMapper.selectByIdAndTenantId(300L, 1L)).thenReturn(document);
        when(knowledgeBaseService.requireContentManageAccess(400L)).thenReturn(kb);

        documentService.retryTask(200L);

        assertThat(task.getStatus()).isEqualTo(TaskStatus.PENDING);
        assertThat(task.getAttempts()).isZero();
        assertThat(task.getMaxAttempts()).isEqualTo(3);
        assertThat(task.getErrorMessage()).isNull();
        assertThat(task.getLockedAt()).isNull();
        assertThat(task.getStartedAt()).isNull();
        assertThat(task.getFinishedAt()).isNull();
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.UPLOADED);
        assertThat(document.getErrorMessage()).isNull();
        verify(taskMapper).updateById(task);
        verify(documentMapper).updateById(document);
        verify(auditLogService).record(eq(user), eq("TASK_RETRY"), eq("RAG_TASK"), eq(200L), any());
    }

    @Test
    void retryTaskRejectsTaskThatHasNotFailed() {
        TestSecurity.login(12L, 1L, "editor@example.com", "资料维护", "USER");
        DocumentEntity document = new DocumentEntity();
        document.setId(301L);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(401L);
        RagTask task = failedTask(201L, 301L);
        task.setStatus(TaskStatus.PENDING);
        when(taskMapper.selectByIdAndTenantId(201L, 1L)).thenReturn(task);
        when(documentMapper.selectByIdAndTenantId(301L, 1L)).thenReturn(document);

        assertThatThrownBy(() -> documentService.retryTask(201L))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("失败任务");
    }

    @Test
    void listTasksReturnsKnowledgeBaseTaskPage() {
        TestSecurity.login(13L, 1L, "manager@example.com", "知识库管理", "USER");
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(400L);
        TaskListRow row = new TaskListRow();
        row.setId(500L);
        row.setTenantId(1L);
        row.setKnowledgeBaseId(400L);
        row.setType(TaskType.REBUILD_KNOWLEDGE_BASE_INDEX);
        row.setStatus(TaskStatus.SUCCEEDED);
        row.setAttempts(1);
        row.setMaxAttempts(3);
        row.setKnowledgeBaseName("客服知识库");
        when(knowledgeBaseService.requireManageAccess(400L)).thenReturn(kb);
        when(taskMapper.countPageByKnowledgeBaseId(1L, 400L, TaskType.REBUILD_KNOWLEDGE_BASE_INDEX, TaskStatus.SUCCEEDED, "索引")).thenReturn(1L);
        when(taskMapper.selectPageByKnowledgeBaseId(1L, 400L, TaskType.REBUILD_KNOWLEDGE_BASE_INDEX, TaskStatus.SUCCEEDED, "索引", 10, 0))
                .thenReturn(List.of(row));

        var page = documentService.listTasks(400L, "REBUILD_KNOWLEDGE_BASE_INDEX", "SUCCEEDED", PageRequestParams.of(1, 10, "索引"));

        assertThat(page.total()).isEqualTo(1);
        assertThat(page.items()).hasSize(1);
        assertThat(page.items().get(0).task().id()).isEqualTo("500");
        assertThat(page.items().get(0).knowledgeBaseName()).isEqualTo("客服知识库");
    }

    @Test
    void getTaskStatsReturnsKnowledgeBaseTaskAggregates() {
        TestSecurity.login(16L, 1L, "manager@example.com", "知识库管理", "USER");
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(410L);
        TaskStatsRow row = new TaskStatsRow();
        row.setTotal(8);
        row.setPending(1);
        row.setRunning(2);
        row.setSucceeded(3);
        row.setFailed(1);
        row.setCancelled(1);
        row.setCancelRequested(1);
        row.setIngestDocument(6);
        row.setRebuildKnowledgeBaseIndex(2);
        row.setAverageDurationMs(1200);
        row.setMaxDurationMs(8000);
        when(knowledgeBaseService.requireManageAccess(410L)).thenReturn(kb);
        when(taskMapper.selectStatsByKnowledgeBaseId(1L, 410L)).thenReturn(row);

        var stats = documentService.getTaskStats(410L);

        assertThat(stats.total()).isEqualTo(8);
        assertThat(stats.running()).isEqualTo(2);
        assertThat(stats.failed()).isEqualTo(1);
        assertThat(stats.cancelRequested()).isEqualTo(1);
        assertThat(stats.ingestDocument()).isEqualTo(6);
        assertThat(stats.rebuildKnowledgeBaseIndex()).isEqualTo(2);
        assertThat(stats.averageDurationMs()).isEqualTo(1200);
        assertThat(stats.maxDurationMs()).isEqualTo(8000);
        verify(knowledgeBaseService).requireManageAccess(410L);
    }

    @Test
    void cancelPendingDocumentTaskMarksTaskCancelledAndDocumentFailed() {
        UserAccount user = TestSecurity.login(14L, 1L, "manager@example.com", "知识库管理", "USER");
        DocumentEntity document = new DocumentEntity();
        document.setId(302L);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(402L);
        document.setStatus(DocumentStatus.UPLOADED);
        RagTask task = pendingTask(202L, 302L);
        when(taskMapper.selectByIdAndTenantId(202L, 1L)).thenReturn(task);
        when(documentMapper.selectByIdAndTenantId(302L, 1L)).thenReturn(document);

        documentService.cancelTask(202L);

        assertThat(task.getStatus()).isEqualTo(TaskStatus.CANCELLED);
        assertThat(task.isCancelRequested()).isTrue();
        assertThat(task.getErrorMessage()).contains("取消");
        assertThat(task.getFinishedAt()).isNotNull();
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(document.getErrorMessage()).contains("取消");
        verify(knowledgeBaseService).requireManageAccess(402L);
        verify(taskMapper).updateById(task);
        verify(documentMapper).updateById(document);
        verify(auditLogService).record(eq(user), eq("TASK_CANCEL"), eq("RAG_TASK"), eq(202L), any());
    }

    @Test
    void cancelRunningTaskRequestsCooperativeCancellation() {
        UserAccount user = TestSecurity.login(15L, 1L, "manager@example.com", "知识库管理", "USER");
        DocumentEntity document = new DocumentEntity();
        document.setId(303L);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(403L);
        RagTask task = pendingTask(203L, 303L);
        task.setStatus(TaskStatus.RUNNING);
        when(taskMapper.selectByIdAndTenantId(203L, 1L)).thenReturn(task);
        when(documentMapper.selectByIdAndTenantId(303L, 1L)).thenReturn(document);

        var response = documentService.cancelTask(203L);

        assertThat(response.status()).isEqualTo("RUNNING");
        assertThat(response.cancelRequested()).isTrue();
        assertThat(task.getStatus()).isEqualTo(TaskStatus.RUNNING);
        assertThat(task.isCancelRequested()).isTrue();
        assertThat(task.getFinishedAt()).isNull();
        assertThat(document.getStatus()).isNotEqualTo(DocumentStatus.FAILED);
        verify(knowledgeBaseService).requireManageAccess(403L);
        verify(taskMapper).updateById(task);
        verify(documentMapper, never()).updateById(document);
        verify(auditLogService).record(eq(user), eq("TASK_CANCEL"), eq("RAG_TASK"), eq(203L), any());
    }

    @Test
    void retryTasksDeduplicatesIdsAndRequeuesFailedTasks() {
        UserAccount user = TestSecurity.login(17L, 1L, "manager@example.com", "知识库管理", "USER");
        DocumentEntity firstDocument = taskDocument(310L, 410L);
        DocumentEntity secondDocument = taskDocument(311L, 410L);
        RagTask firstTask = failedTask(210L, 310L);
        RagTask secondTask = failedTask(211L, 311L);
        when(taskMapper.selectByIdAndTenantId(210L, 1L)).thenReturn(firstTask);
        when(taskMapper.selectByIdAndTenantId(211L, 1L)).thenReturn(secondTask);
        when(documentMapper.selectByIdAndTenantId(310L, 1L)).thenReturn(firstDocument);
        when(documentMapper.selectByIdAndTenantId(311L, 1L)).thenReturn(secondDocument);

        var responses = documentService.retryTasks(List.of(210L, 211L, 210L));

        assertThat(responses).hasSize(2);
        assertThat(firstTask.getStatus()).isEqualTo(TaskStatus.PENDING);
        assertThat(secondTask.getStatus()).isEqualTo(TaskStatus.PENDING);
        assertThat(firstDocument.getStatus()).isEqualTo(DocumentStatus.UPLOADED);
        assertThat(secondDocument.getStatus()).isEqualTo(DocumentStatus.UPLOADED);
        verify(taskMapper).updateById(firstTask);
        verify(taskMapper).updateById(secondTask);
        verify(documentMapper).updateById(firstDocument);
        verify(documentMapper).updateById(secondDocument);
        verify(auditLogService).record(eq(user), eq("TASK_RETRY"), eq("RAG_TASK"), eq(210L), any());
        verify(auditLogService).record(eq(user), eq("TASK_RETRY"), eq("RAG_TASK"), eq(211L), any());
    }

    @Test
    void cancelTasksCancelsPendingAndRequestsRunningTasks() {
        UserAccount user = TestSecurity.login(18L, 1L, "manager@example.com", "知识库管理", "USER");
        DocumentEntity pendingDocument = taskDocument(312L, 412L);
        DocumentEntity runningDocument = taskDocument(313L, 413L);
        runningDocument.setStatus(DocumentStatus.PROCESSING);
        RagTask pendingTask = pendingTask(212L, 312L);
        RagTask runningTask = pendingTask(213L, 313L);
        runningTask.setStatus(TaskStatus.RUNNING);
        when(taskMapper.selectByIdAndTenantId(212L, 1L)).thenReturn(pendingTask);
        when(taskMapper.selectByIdAndTenantId(213L, 1L)).thenReturn(runningTask);
        when(documentMapper.selectByIdAndTenantId(312L, 1L)).thenReturn(pendingDocument);
        when(documentMapper.selectByIdAndTenantId(313L, 1L)).thenReturn(runningDocument);

        var responses = documentService.cancelTasks(List.of(212L, 213L));

        assertThat(responses).hasSize(2);
        assertThat(pendingTask.getStatus()).isEqualTo(TaskStatus.CANCELLED);
        assertThat(pendingTask.isCancelRequested()).isTrue();
        assertThat(pendingDocument.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(runningTask.getStatus()).isEqualTo(TaskStatus.RUNNING);
        assertThat(runningTask.isCancelRequested()).isTrue();
        assertThat(runningDocument.getStatus()).isNotEqualTo(DocumentStatus.FAILED);
        verify(taskMapper).updateById(pendingTask);
        verify(taskMapper).updateById(runningTask);
        verify(documentMapper).updateById(pendingDocument);
        verify(documentMapper, never()).updateById(runningDocument);
        verify(auditLogService).record(eq(user), eq("TASK_CANCEL"), eq("RAG_TASK"), eq(212L), any());
        verify(auditLogService).record(eq(user), eq("TASK_CANCEL"), eq("RAG_TASK"), eq(213L), any());
    }

    private static AppProperties testProperties() {
        return new AppProperties(
                new AppProperties.Security("secret", 60),
                new AppProperties.Storage("http://localhost:9000", "a", "b", "bucket"),
                new AppProperties.Milvus("http://localhost:19530", "default", "rag_document_chunks", false),
                new AppProperties.Model("http://localhost", "", "chat", "embedding", 1536),
                new AppProperties.Ingestion(true, 1000, 3, 1, 600000),
                new AppProperties.Retrieval(0.65, 0.35));
    }

    private static RagTask failedTask(Long taskId, Long documentId) {
        RagTask task = new RagTask();
        task.setId(taskId);
        task.setTenantId(1L);
        task.setDocumentId(documentId);
        task.setType(TaskType.INGEST_DOCUMENT);
        task.setStatus(TaskStatus.FAILED);
        task.setAttempts(3);
        task.setMaxAttempts(3);
        task.setErrorMessage("embedding failed");
        task.setLockedAt(Instant.now().minusSeconds(60));
        task.setStartedAt(Instant.now().minusSeconds(120));
        task.setFinishedAt(Instant.now());
        return task;
    }

    private static RagTask pendingTask(Long taskId, Long documentId) {
        RagTask task = new RagTask();
        task.setId(taskId);
        task.setTenantId(1L);
        task.setDocumentId(documentId);
        task.setType(TaskType.INGEST_DOCUMENT);
        task.setStatus(TaskStatus.PENDING);
        task.setAttempts(0);
        task.setMaxAttempts(3);
        return task;
    }

    private static DocumentEntity taskDocument(Long documentId, Long knowledgeBaseId) {
        DocumentEntity document = new DocumentEntity();
        document.setId(documentId);
        document.setTenantId(1L);
        document.setKnowledgeBaseId(knowledgeBaseId);
        document.setFileName("task-" + documentId + ".md");
        document.setStatus(DocumentStatus.FAILED);
        document.setErrorMessage("old error");
        return document;
    }
}
