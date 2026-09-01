package com.example.rag.mapper;

/**
 * 任务中心聚合统计行。
 */
public class TaskStatsRow {
    private long total;
    private long pending;
    private long running;
    private long succeeded;
    private long failed;
    private long cancelled;
    private long cancelRequested;
    private long ingestDocument;
    private long rebuildKnowledgeBaseIndex;
    private long averageDurationMs;
    private long maxDurationMs;

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public long getPending() {
        return pending;
    }

    public void setPending(long pending) {
        this.pending = pending;
    }

    public long getRunning() {
        return running;
    }

    public void setRunning(long running) {
        this.running = running;
    }

    public long getSucceeded() {
        return succeeded;
    }

    public void setSucceeded(long succeeded) {
        this.succeeded = succeeded;
    }

    public long getFailed() {
        return failed;
    }

    public void setFailed(long failed) {
        this.failed = failed;
    }

    public long getCancelled() {
        return cancelled;
    }

    public void setCancelled(long cancelled) {
        this.cancelled = cancelled;
    }

    public long getCancelRequested() {
        return cancelRequested;
    }

    public void setCancelRequested(long cancelRequested) {
        this.cancelRequested = cancelRequested;
    }

    public long getIngestDocument() {
        return ingestDocument;
    }

    public void setIngestDocument(long ingestDocument) {
        this.ingestDocument = ingestDocument;
    }

    public long getRebuildKnowledgeBaseIndex() {
        return rebuildKnowledgeBaseIndex;
    }

    public void setRebuildKnowledgeBaseIndex(long rebuildKnowledgeBaseIndex) {
        this.rebuildKnowledgeBaseIndex = rebuildKnowledgeBaseIndex;
    }

    public long getAverageDurationMs() {
        return averageDurationMs;
    }

    public void setAverageDurationMs(long averageDurationMs) {
        this.averageDurationMs = averageDurationMs;
    }

    public long getMaxDurationMs() {
        return maxDurationMs;
    }

    public void setMaxDurationMs(long maxDurationMs) {
        this.maxDurationMs = maxDurationMs;
    }
}
