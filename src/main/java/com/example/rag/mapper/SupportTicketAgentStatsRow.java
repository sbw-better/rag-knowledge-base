package com.example.rag.mapper;

/**
 * 售后坐席维度统计行。
 */
public class SupportTicketAgentStatsRow {
    private Long assigneeId;
    private String assigneeName;
    private long assignedTickets;
    private long openTickets;
    private long resolvedTickets;
    private long outgoingReplies;
    private Integer avgFirstResponseMinutes;
    private Integer slaAttainmentRate;

    public Long getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(Long assigneeId) {
        this.assigneeId = assigneeId;
    }

    public String getAssigneeName() {
        return assigneeName;
    }

    public void setAssigneeName(String assigneeName) {
        this.assigneeName = assigneeName;
    }

    public long getAssignedTickets() {
        return assignedTickets;
    }

    public void setAssignedTickets(long assignedTickets) {
        this.assignedTickets = assignedTickets;
    }

    public long getOpenTickets() {
        return openTickets;
    }

    public void setOpenTickets(long openTickets) {
        this.openTickets = openTickets;
    }

    public long getResolvedTickets() {
        return resolvedTickets;
    }

    public void setResolvedTickets(long resolvedTickets) {
        this.resolvedTickets = resolvedTickets;
    }

    public long getOutgoingReplies() {
        return outgoingReplies;
    }

    public void setOutgoingReplies(long outgoingReplies) {
        this.outgoingReplies = outgoingReplies;
    }

    public Integer getAvgFirstResponseMinutes() {
        return avgFirstResponseMinutes;
    }

    public void setAvgFirstResponseMinutes(Integer avgFirstResponseMinutes) {
        this.avgFirstResponseMinutes = avgFirstResponseMinutes;
    }

    public Integer getSlaAttainmentRate() {
        return slaAttainmentRate;
    }

    public void setSlaAttainmentRate(Integer slaAttainmentRate) {
        this.slaAttainmentRate = slaAttainmentRate;
    }
}
