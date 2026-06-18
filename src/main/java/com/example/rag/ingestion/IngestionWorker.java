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
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class IngestionWorker {
    private final RagTaskRepository taskRepository;
    private final DocumentRepository documentRepository;
    private final StorageService storageService;
    private final DocumentParserService parserService;
    private final TextChunker textChunker;
    private final EmbeddingClient embeddingClient;
    private final VectorIndexService vectorIndexService;
    private final AppProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    @Scheduled(fixedDelayString = "${app.ingestion.fixed-delay-ms:5000}")
    public void run() {
        if (!properties.ingestion().workerEnabled()) {
            return;
        }
        List<RagTask> tasks = taskRepository.findRunnable(TaskStatus.PENDING, PageRequest.of(0, properties.ingestion().batchSize()));
        for (RagTask task : tasks) {
            process(task.getId());
        }
    }

    @Transactional
    public void process(UUID taskId) {
        RagTask task = taskRepository.findById(taskId).orElseThrow();
        DocumentEntity document = task.getDocument();
        try {
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
        } catch (Exception ex) {
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
