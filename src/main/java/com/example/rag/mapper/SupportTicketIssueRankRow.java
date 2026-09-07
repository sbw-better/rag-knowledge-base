package com.example.rag.mapper;

import java.time.Instant;

/**
 * 售后工单无答案问题排行行。
 */
public class SupportTicketIssueRankRow {
    private String question;
    private long total;
    private Instant latestAt;

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public Instant getLatestAt() {
        return latestAt;
    }

    public void setLatestAt(Instant latestAt) {
        this.latestAt = latestAt;
    }
}
