package com.example.rag.ingestion;

import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.DocumentStatus;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.model.EmbeddingClient;
import com.example.rag.parser.DocumentParserService;
import com.example.rag.parser.TextChunker;
import com.example.rag.retrieval.VectorIndexService;
import com.example.rag.storage.StorageService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class IngestionWorkerTimeoutRecoveryTest {
    private final RagTaskMapper taskMapper = mock(RagTaskMapper.class);
    private final DocumentMapper documentMapper = mock(DocumentMapper.class);
    private final TransactionTemplate transactionTemplate = mock(TransactionTemplate.class);

    @Test
    void timedOutRunningTaskIsRequeuedWhenAttemptsRemain() {
        RagTask task = runningTask(100L, 200L, 1, 3);
        DocumentEntity document = document(200L);
        IngestionWorker worker = worker();
        when(taskMapper.selectTimedOutRunning(eq(TaskType.INGEST_DOCUMENT), eq(TaskStatus.RUNNING), any(Instant.class), eq(2))).thenReturn(List.of(task));
        when(taskMapper.selectById(100L)).thenReturn(task);
        when(documentMapper.selectById(200L)).thenReturn(document);

        worker.recoverTimedOutTasks();

        assertThat(task.getStatus()).isEqualTo(TaskStatus.PENDING);
        assertThat(task.getLockedAt()).isNull();
        assertThat(task.getErrorMessage()).contains("自动重新排队");
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.UPLOADED);
        verify(taskMapper).updateById(task);
        verify(documentMapper).updateById(document);
    }

    @Test
    void timedOutRunningTaskFailsWhenMaxAttemptsReached() {
        RagTask task = runningTask(101L, 201L, 3, 3);
        DocumentEntity document = document(201L);
        IngestionWorker worker = worker();
        when(taskMapper.selectTimedOutRunning(eq(TaskType.INGEST_DOCUMENT), eq(TaskStatus.RUNNING), any(Instant.class), eq(2))).thenReturn(List.of(task));
        when(taskMapper.selectById(101L)).thenReturn(task);
        when(documentMapper.selectById(201L)).thenReturn(document);

        worker.recoverTimedOutTasks();

        assertThat(task.getStatus()).isEqualTo(TaskStatus.FAILED);
        assertThat(task.getFinishedAt()).isNotNull();
        assertThat(task.getErrorMessage()).contains("最大重试次数");
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
        verify(taskMapper).updateById(task);
        verify(documentMapper).updateById(document);
    }

    @Test
    void cancelledRunningTaskIsMarkedCancelledBeforeProcessing() {
        RagTask task = runningTask(102L, 202L, 1, 3);
        task.setCancelRequested(true);
        DocumentEntity document = document(202L);
        IngestionWorker worker = worker();
        when(taskMapper.selectById(102L)).thenReturn(task);
        when(documentMapper.selectById(202L)).thenReturn(document);

        worker.process(102L);

        assertThat(task.getStatus()).isEqualTo(TaskStatus.CANCELLED);
        assertThat(task.getFinishedAt()).isNotNull();
        assertThat(task.getErrorMessage()).contains("取消");
        assertThat(document.getStatus()).isEqualTo(DocumentStatus.FAILED);
        assertThat(document.getErrorMessage()).contains("取消");
        verify(taskMapper).updateById(task);
        verify(documentMapper).updateById(document);
    }

    private IngestionWorker worker() {
        doAnswer(invocation -> {
            Consumer<TransactionStatus> callback = invocation.getArgument(0);
            callback.accept(null);
            return null;
        }).when(transactionTemplate).executeWithoutResult(any());

        return new IngestionWorker(
                taskMapper,
                documentMapper,
                mock(KnowledgeBaseMapper.class),
                mock(StorageService.class),
                mock(DocumentParserService.class),
                mock(TextChunker.class),
                mock(EmbeddingClient.class),
                mock(VectorIndexService.class),
                new AppProperties(
                        new AppProperties.Security("secret", 60),
                        new AppProperties.Storage("http://localhost:9000", "a", "b", "bucket"),
                        new AppProperties.Milvus("http://localhost:19530", "default", "rag_document_chunks", false),
                        new AppProperties.Model("http://localhost", "", "chat", "embedding", 1536),
                        new AppProperties.Ingestion(true, 1000, 3, 2, 600000),
                        new AppProperties.Retrieval(0.65, 0.35)),
                transactionTemplate);
    }

    private static RagTask runningTask(Long taskId, Long documentId, int attempts, int maxAttempts) {
        RagTask task = new RagTask();
        task.setId(taskId);
        task.setDocumentId(documentId);
        task.setStatus(TaskStatus.RUNNING);
        task.setAttempts(attempts);
        task.setMaxAttempts(maxAttempts);
        task.setLockedAt(Instant.now().minusSeconds(900));
        return task;
    }

    private static DocumentEntity document(Long id) {
        DocumentEntity document = new DocumentEntity();
        document.setId(id);
        document.setStatus(DocumentStatus.PROCESSING);
        return document;
    }
}
