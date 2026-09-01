package com.example.rag.retrieval;

import com.example.rag.config.AppProperties;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import com.example.rag.mapper.RagTaskMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;

/**
 * 索引维护后台 Worker。
 *
 * <p>索引重建可能涉及大量 embedding 调用，不应阻塞 HTTP 请求。该 Worker 只消费
 * {@link TaskType#REBUILD_KNOWLEDGE_BASE_INDEX}，文档入库任务仍由 IngestionWorker 处理。</p>
 */
@Service
public class IndexMaintenanceWorker {
    private static final Logger log = LoggerFactory.getLogger(IndexMaintenanceWorker.class);

    private final RagTaskMapper taskMapper;
    private final IndexMaintenanceService indexMaintenanceService;
    private final AppProperties properties;
    private final TransactionTemplate transactionTemplate;

    public IndexMaintenanceWorker(RagTaskMapper taskMapper,
                                  IndexMaintenanceService indexMaintenanceService,
                                  AppProperties properties,
                                  TransactionTemplate transactionTemplate) {
        this.taskMapper = taskMapper;
        this.indexMaintenanceService = indexMaintenanceService;
        this.properties = properties;
        this.transactionTemplate = transactionTemplate;
    }

    @Scheduled(fixedDelayString = "${app.ingestion.fixed-delay-ms:5000}")
    public void run() {
        if (!properties.ingestion().workerEnabled()) {
            return;
        }
        recoverTimedOutTasks();
        List<RagTask> tasks = taskMapper.selectRunnable(
                TaskType.REBUILD_KNOWLEDGE_BASE_INDEX, TaskStatus.PENDING, properties.ingestion().batchSize());
        if (!tasks.isEmpty()) {
            log.info("索引维护 Worker 拉取到待处理任务。count={}", tasks.size());
        }
        for (RagTask task : tasks) {
            indexMaintenanceService.rebuildKnowledgeBaseTask(task.getId());
        }
    }

    void recoverTimedOutTasks() {
        long timeoutMs = properties.ingestion().runningTimeoutMs();
        if (timeoutMs <= 0) {
            return;
        }
        Instant threshold = Instant.now().minusMillis(timeoutMs);
        List<RagTask> timedOutTasks = taskMapper.selectTimedOutRunning(
                TaskType.REBUILD_KNOWLEDGE_BASE_INDEX, TaskStatus.RUNNING, threshold, properties.ingestion().batchSize());
        if (timedOutTasks.isEmpty()) {
            return;
        }
        log.warn("发现超时的索引重建任务，准备自动恢复。count={}, timeoutMs={}", timedOutTasks.size(), timeoutMs);
        for (RagTask task : timedOutTasks) {
            transactionTemplate.executeWithoutResult(status -> indexMaintenanceService.recoverTimedOutTask(task.getId()));
        }
    }
}
