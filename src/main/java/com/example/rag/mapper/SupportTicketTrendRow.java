package com.example.rag.mapper;

/**
 * 售后看板每日趋势统计行。
 */
public class SupportTicketTrendRow {
    private String dateLabel;
    private long total;
    private long resolved;
    private long overdue;
    private long outgoingReplies;

    public String getDateLabel() {
        return dateLabel;
    }

    public void setDateLabel(String dateLabel) {
        this.dateLabel = dateLabel;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public long getResolved() {
        return resolved;
    }

    public void setResolved(long resolved) {
        this.resolved = resolved;
    }

    public long getOverdue() {
        return overdue;
    }

    public void setOverdue(long overdue) {
        this.overdue = overdue;
    }

    public long getOutgoingReplies() {
        return outgoingReplies;
    }

    public void setOutgoingReplies(long outgoingReplies) {
        this.outgoingReplies = outgoingReplies;
    }
}
