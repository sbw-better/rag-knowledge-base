package com.example.rag.ingestion;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.DocumentStatus;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.model.EmbeddingClient;
import com.example.rag.parser.DocumentParserService;
import com.example.rag.parser.TextChunker;
import com.example.rag.repository.DocumentRepository;
import com.example.rag.repository.RagTaskRepository;
import com.example.rag.retrieval.VectorIndexService;
import com.example.rag.storage.StorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class IngestionWorker {
    private static final Logger log = LoggerFactory.getLogger(IngestionWorker.class);

    public IngestionWorker(RagTaskRepository taskRepository, DocumentRepository documentRepository, StorageService storageService, DocumentParserService parserService, TextChunker textChunker, EmbeddingClient embeddingClient, VectorIndexService vectorIndexService, AppProperties properties, TransactionTemplate transactionTemplate) {
        this.taskRepository = taskRepository;
        this.documentRepository = documentRepository;
        this.storageService = storageService;
        this.parserService = parserService;
        this.textChunker = textChunker;
        this.embeddingClient = embeddingClient;
        this.vectorIndexService = vectorIndexService;
        this.properties = properties;
        this.transactionTemplate = transactionTemplate;
    }

    private final RagTaskRepository taskRepository;
    private final DocumentRepository documentRepository;
    private final StorageService storageService;
    private final DocumentParserService parserService;
    private final TextChunker textChunker;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;
    private final AppProperties properties;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Scheduled(fixedDelayString = "${app.ingestion.fixed-delay-ms:5000}")
    public void run() {
        if (!properties.ingestion().workerEnabled()) {
            return;
        }
        List<RagTask> tasks = taskRepository.findRunnable(TaskStatus.PENDING, PageRequest.of(0, properties.ingestion().batchSize()));
        for (RagTask task : tasks) {
            transactionTemplate.executeWithoutResult(status -> process(task.getId()));
        }
    }

    void process(UUID taskId) {
        RagTask task = taskRepository.findById(taskId).orElseThrow();
        DocumentEntity document = task.getDocument();
        try {
            log.info("Starting ingestion task. taskId={}, documentId={}, fileName={}",
                    task.getId(), document.getId(), document.getFileName());
            task.setStatus(TaskStatus.RUNNING);
            task.setAttempts(task.getAttempts() + 1);
            task.setStartedAt(Instant.now());
            task.setLockedAt(Instant.now());
            document.setStatus(DocumentStatus.PROCESSING);
            taskRepository.save(task);
            documentRepository.save(document);

            String text;
            try (InputStream inputStream = storageService.open(document.getObjectKey())) {
                text = parserService.parse(inputStream);
            }
            List<String> chunks = textChunker.split(text, document.getKnowledgeBase().getChunkSize(),
                    document.getKnowledgeBase().getChunkOverlap());
            if (chunks.isEmpty()) {
                throw new BadRequestException("Parsed document is empty");
            }
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
            log.info("Ingestion task succeeded. taskId={}, documentId={}, chunks={}",
                    task.getId(), document.getId(), chunks.size());
        } catch (Throwable ex) {
            log.error("Ingestion task failed. taskId={}, documentId={}, fileName={}, attempt={}/{}",
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
        }
    }
}
