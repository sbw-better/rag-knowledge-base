package com.example.rag.ingestion;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.DocumentStatus;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.RagTaskMapper;
import com.example.rag.model.EmbeddingClient;
import com.example.rag.parser.DocumentParserService;
import com.example.rag.parser.TextChunker;
import com.example.rag.retrieval.VectorIndexService;
import com.example.rag.storage.StorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 文档异步入库 Worker。
 *
 * <p>MVP 阶段没有引入 MQ，而是使用数据库任务表 {@code rag_tasks} 作为轻量队列。
 * Scheduler 周期性拉取 PENDING 任务并在独立事务中处理，每个任务完成文档解析、
 * 清洗切分、Embedding 和 Milvus 向量入库。后续迁移 RabbitMQ/Kafka 时，该类的处理逻辑
 * 可以保留，触发方式替换为消息消费即可。</p>
 */
@Service
public class IngestionWorker {
    private static final Logger log = LoggerFactory.getLogger(IngestionWorker.class);

    private final RagTaskMapper taskMapper;
    private final DocumentMapper documentMapper;
    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final StorageService storageService;
    private final DocumentParserService parserService;
    private final TextChunker textChunker;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;
    private final AppProperties properties;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public IngestionWorker(RagTaskMapper taskMapper,
                           DocumentMapper documentMapper,
                           KnowledgeBaseMapper knowledgeBaseMapper,
                           StorageService storageService,
                           DocumentParserService parserService,
                           TextChunker textChunker,
                           EmbeddingClient embeddingClient,
                           VectorIndexService vectorIndexService,
                           AppProperties properties,
                           TransactionTemplate transactionTemplate) {
        this.taskMapper = taskMapper;
        this.documentMapper = documentMapper;
        this.knowledgeBaseMapper = knowledgeBaseMapper;
        this.storageService = storageService;
        this.parserService = parserService;
        this.textChunker = textChunker;
        this.embeddingClient = embeddingClient;
        this.vectorIndexService = vectorIndexService;
        this.properties = properties;
        this.transactionTemplate = transactionTemplate;
    }

    @Scheduled(fixedDelayString = "${app.ingestion.fixed-delay-ms:5000}")
    public void run() {
        if (!properties.ingestion().workerEnabled()) {
            return;
        }
        recoverTimedOutTasks();
        List<RagTask> tasks = taskMapper.selectRunnable(TaskStatus.PENDING, properties.ingestion().batchSize());
        if (!tasks.isEmpty()) {
            log.info("文档入库 Worker 拉取到待处理任务。count={}", tasks.size());
        }
        for (RagTask task : tasks) {
            transactionTemplate.executeWithoutResult(status -> process(task.getId()));
        }
    }

    /**
     * 恢复长时间停留在 RUNNING 的任务。
     *
     * <p>数据库任务队列没有 MQ 的 ack/visibility-timeout 机制。若服务在处理文档时被杀掉，
     * 任务可能已经被标记为 RUNNING，但后续不会再被 {@link #run()} 扫描到。这里根据
     * {@code locked_at} 和 {@code app.ingestion.running-timeout-ms} 找出超时任务：
     * 未达到最大尝试次数时重新置为 PENDING，达到上限时标记 FAILED。</p>
     */
    void recoverTimedOutTasks() {
        long timeoutMs = properties.ingestion().runningTimeoutMs();
        if (timeoutMs <= 0) {
            return;
        }
        Instant threshold = Instant.now().minusMillis(timeoutMs);
        List<RagTask> timedOutTasks = taskMapper.selectTimedOutRunning(
                TaskStatus.RUNNING, threshold, properties.ingestion().batchSize());
        if (timedOutTasks.isEmpty()) {
            return;
        }
        log.warn("发现超时的文档入库任务，准备自动恢复。count={}, timeoutMs={}", timedOutTasks.size(), timeoutMs);
        for (RagTask task : timedOutTasks) {
            transactionTemplate.executeWithoutResult(status -> recoverTimedOutTask(task.getId()));
        }
    }

    private void recoverTimedOutTask(Long taskId) {
        RagTask task = taskMapper.selectById(taskId);
        if (task == null || task.getStatus() != TaskStatus.RUNNING) {
            return;
        }
        DocumentEntity document = documentMapper.selectById(task.getDocumentId());
        String message;
        if (task.getAttempts() >= task.getMaxAttempts()) {
            message = "文档入库任务执行超时，且已达到最大重试次数";
            task.setStatus(TaskStatus.FAILED);
            task.setFinishedAt(Instant.now());
            if (document != null) {
                document.setStatus(DocumentStatus.FAILED);
                document.setErrorMessage(message);
                documentMapper.updateById(document);
            }
            log.error("文档入库任务超时后已标记失败。taskId={}, documentId={}, attempts={}/{}",
                    task.getId(), task.getDocumentId(), task.getAttempts(), task.getMaxAttempts());
        } else {
            message = "文档入库任务执行超时，已自动重新排队";
            task.setStatus(TaskStatus.PENDING);
            task.setLockedAt(null);
            if (document != null) {
                document.setStatus(DocumentStatus.UPLOADED);
                document.setErrorMessage(message);
                documentMapper.updateById(document);
            }
            log.warn("文档入库任务超时后已重新排队。taskId={}, documentId={}, attempts={}/{}",
                    task.getId(), task.getDocumentId(), task.getAttempts(), task.getMaxAttempts());
        }
        task.setErrorMessage(message);
        taskMapper.updateById(task);
    }

    /**
     * 处理单个入库任务。
     *
     * <p>这里捕获 {@link Throwable} 是为了保证单个文档失败不会让调度线程退出。
     * 失败任务会根据 attempts/maxAttempts 决定重新置为 PENDING 还是最终 FAILED。</p>
     */
    void process(Long taskId) {
        RagTask task = taskMapper.selectById(taskId);
        if (task == null) {
            throw new BadRequestException("任务不存在");
        }
        DocumentEntity document = documentMapper.selectById(task.getDocumentId());
        if (document == null) {
            throw new BadRequestException("文档不存在");
        }
        KnowledgeBase kb = knowledgeBaseMapper.selectById(document.getKnowledgeBaseId());
        if (kb == null || kb.isDeleted()) {
            throw new BadRequestException("知识库不存在");
        }
        try {
            log.info("开始执行文档入库任务。taskId={}, documentId={}, fileName={}",
                    task.getId(), document.getId(), document.getFileName());
            task.setStatus(TaskStatus.RUNNING);
            task.setAttempts(task.getAttempts() + 1);
            task.setStartedAt(Instant.now());
            task.setLockedAt(Instant.now());
            document.setStatus(DocumentStatus.PROCESSING);
            taskMapper.updateById(task);
            documentMapper.updateById(document);

            String text;
            try (InputStream inputStream = storageService.open(document.getObjectKey())) {
                text = parserService.parse(inputStream);
            }
            log.debug("文档解析完成。taskId={}, documentId={}, textLength={}",
                    task.getId(), document.getId(), text.length());
            List<String> chunks = textChunker.split(text, kb.getChunkSize(), kb.getChunkOverlap());
            if (chunks.isEmpty()) {
                throw new BadRequestException("解析后的文档内容为空");
            }
            log.info("文档切片完成。taskId={}, documentId={}, chunks={}, chunkSize={}, overlap={}",
                    task.getId(), document.getId(), chunks.size(), kb.getChunkSize(), kb.getChunkOverlap());
            vectorIndexService.deleteByDocument(document.getId());
            for (int i = 0; i < chunks.size(); i++) {
                Map<String, Object> metadata = Map.of("fileName", document.getFileName(), "chunkIndex", i);
                vectorIndexService.saveChunk(document, i, chunks.get(i), objectMapper.writeValueAsString(metadata),
                        embeddingClient.embed(chunks.get(i)));
            }
            document.setStatus(DocumentStatus.INDEXED);
            document.setErrorMessage(null);
            task.setStatus(TaskStatus.SUCCEEDED);
            task.setFinishedAt(Instant.now());
            task.setErrorMessage(null);
            log.info("文档入库任务执行成功。taskId={}, documentId={}, chunks={}",
                    task.getId(), document.getId(), chunks.size());
        } catch (Throwable ex) {
            log.error("文档入库任务执行失败。taskId={}, documentId={}, fileName={}, attempt={}/{}",
                    task.getId(),
                    document.getId(),
                    document.getFileName(),
                    task.getAttempts(),
                    task.getMaxAttempts(),
                    ex);
            document.setStatus(DocumentStatus.FAILED);
            document.setErrorMessage(ex.getMessage());
            task.setErrorMessage(ex.getMessage());
            task.setStatus(task.getAttempts() >= task.getMaxAttempts() ? TaskStatus.FAILED : TaskStatus.PENDING);
            if (task.getStatus() == TaskStatus.FAILED) {
                task.setFinishedAt(Instant.now());
            }
        } finally {
            documentMapper.updateById(document);
            taskMapper.updateById(task);
        }
    }
}
