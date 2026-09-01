package com.example.rag.retrieval;

import com.example.rag.audit.AuditLogService;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.domain.UserAccount;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.model.EmbeddingClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IndexMaintenanceServiceTest {
    private final KnowledgeBaseService knowledgeBaseService = mock(KnowledgeBaseService.class);
    private final DocumentChunkMapper chunkMapper = mock(DocumentChunkMapper.class);
    private final DocumentMapper documentMapper = mock(DocumentMapper.class);
    private final RagTaskMapper taskMapper = mock(RagTaskMapper.class);
    private final EmbeddingClient embeddingClient = mock(EmbeddingClient.class);
    private final VectorIndexService vectorIndexService = mock(VectorIndexService.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    private IndexMaintenanceService service;

    @BeforeEach
    void setUp() {
        service = new IndexMaintenanceService(
                knowledgeBaseService,
                chunkMapper,
                documentMapper,
                taskMapper,
                embeddingClient,
                vectorIndexService,
                auditLogService,
                testProperties());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void enqueueKnowledgeBaseRebuildCreatesPendingTask() {
        UserAccount user = login(10L, 1L);
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(200L);
        when(knowledgeBaseService.requireManageAccess(200L)).thenReturn(kb);
        doAnswer(invocation -> {
            RagTask task = invocation.getArgument(0);
            task.setId(300L);
            return 1;
        }).when(taskMapper).insert(any(RagTask.class));

        var response = service.enqueueKnowledgeBaseRebuild(200L);

        assertThat(response.id()).isEqualTo("300");
        assertThat(response.knowledgeBaseId()).isEqualTo("200");
        assertThat(response.type()).isEqualTo("REBUILD_KNOWLEDGE_BASE_INDEX");
        assertThat(response.status()).isEqualTo("PENDING");
        verify(taskMapper).insert(any(RagTask.class));
        verify(auditLogService).record(eq(user), eq("KNOWLEDGE_BASE_INDEX_REBUILD_REQUEST"), eq("KNOWLEDGE_BASE"), eq(200L), any());
    }

    @Test
    void rebuildKnowledgeBaseTaskRebuildsExistingChunksAndMarksSucceeded() {
        RagTask task = new RagTask();
        task.setId(301L);
        task.setTenantId(1L);
        task.setKnowledgeBaseId(201L);
        task.setType(TaskType.REBUILD_KNOWLEDGE_BASE_INDEX);
        task.setStatus(TaskStatus.PENDING);
        task.setMaxAttempts(3);
        DocumentChunk chunk = chunk(401L, 501L, 0, "refund policy");
        DocumentEntity document = new DocumentEntity();
        document.setId(501L);
        document.setKnowledgeBaseId(201L);
        when(taskMapper.selectById(301L)).thenReturn(task);
        when(chunkMapper.selectByKnowledgeBaseId(201L)).thenReturn(List.of(chunk));
        when(documentMapper.selectById(501L)).thenReturn(document);
        when(embeddingClient.embed("refund policy")).thenReturn(List.of(0.1, 0.2));

        service.rebuildKnowledgeBaseTask(301L);

        assertThat(task.getStatus()).isEqualTo(TaskStatus.SUCCEEDED);
        assertThat(task.getAttempts()).isEqualTo(1);
        assertThat(task.getFinishedAt()).isNotNull();
        assertThat(task.getErrorMessage()).contains("已重建 1/1");
        verify(vectorIndexService).deleteVectorIndexByKnowledgeBase(201L);
        verify(vectorIndexService).upsertExistingChunk(document, chunk, List.of(0.1, 0.2));
        verify(taskMapper, times(2)).updateById(task);
    }

    @Test
    void rebuildKnowledgeBaseTaskCancelsBeforeDeletingIndex() {
        RagTask task = new RagTask();
        task.setId(302L);
        task.setTenantId(1L);
        task.setKnowledgeBaseId(202L);
        task.setType(TaskType.REBUILD_KNOWLEDGE_BASE_INDEX);
        task.setStatus(TaskStatus.PENDING);
        task.setMaxAttempts(3);
        RagTask cancelled = new RagTask();
        cancelled.setId(302L);
        cancelled.setCancelRequested(true);
        when(taskMapper.selectById(302L)).thenReturn(task, cancelled);
        when(chunkMapper.selectByKnowledgeBaseId(202L)).thenReturn(List.of());

        service.rebuildKnowledgeBaseTask(302L);

        assertThat(task.getStatus()).isEqualTo(TaskStatus.CANCELLED);
        assertThat(task.isCancelRequested()).isTrue();
        assertThat(task.getFinishedAt()).isNotNull();
        assertThat(task.getErrorMessage()).contains("取消");
        verify(vectorIndexService, never()).deleteVectorIndexByKnowledgeBase(202L);
        verify(taskMapper, times(2)).updateById(task);
    }

    private static UserAccount login(Long userId, Long tenantId) {
        UserAccount user = new UserAccount();
        user.setId(userId);
        user.setTenantId(tenantId);
        user.setEmail("manager@example.com");
        user.setDisplayName("知识库管理员");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null));
        return user;
    }

    private static DocumentChunk chunk(Long id, Long documentId, int index, String content) {
        DocumentChunk chunk = new DocumentChunk();
        chunk.setId(id);
        chunk.setTenantId(1L);
        chunk.setKnowledgeBaseId(201L);
        chunk.setDocumentId(documentId);
        chunk.setChunkIndex(index);
        chunk.setContent(content);
        return chunk;
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
}
