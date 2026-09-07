package com.example.rag.mapper;

/**
 * 售后工单关联知识缺口统计行。
 */
public class SupportTicketIssueStatsRow {
    private long openKnowledgeIssues;
    private long noContextIssues;

    public long getOpenKnowledgeIssues() {
        return openKnowledgeIssues;
    }

    public void setOpenKnowledgeIssues(long openKnowledgeIssues) {
        this.openKnowledgeIssues = openKnowledgeIssues;
    }

    public long getNoContextIssues() {
        return noContextIssues;
    }

    public void setNoContextIssues(long noContextIssues) {
        this.noContextIssues = noContextIssues;
    }
}
