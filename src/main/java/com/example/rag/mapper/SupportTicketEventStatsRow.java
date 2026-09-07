package com.example.rag.mapper;

/**
 * 售后工单事件统计行。
 */
public class SupportTicketEventStatsRow {
    private long aiReplyGenerated;
    private long outgoingReplies;
    private long customerMessages;

    public long getAiReplyGenerated() {
        return aiReplyGenerated;
    }

    public void setAiReplyGenerated(long aiReplyGenerated) {
        this.aiReplyGenerated = aiReplyGenerated;
    }

    public long getOutgoingReplies() {
        return outgoingReplies;
    }

    public void setOutgoingReplies(long outgoingReplies) {
        this.outgoingReplies = outgoingReplies;
    }

    public long getCustomerMessages() {
        return customerMessages;
    }

    public void setCustomerMessages(long customerMessages) {
        this.customerMessages = customerMessages;
    }
}
