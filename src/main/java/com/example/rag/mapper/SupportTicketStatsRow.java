package com.example.rag.mapper;

/**
 * 售后工单运营统计聚合行。
 */
public class SupportTicketStatsRow {
    private long total;
    private long open;
    private long inProgress;
    private long waitingCustomer;
    private long resolved;
    private long closed;
    private long overdue;
    private Integer avgFirstResponseMinutes;
    private Integer slaAttainmentRate;

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public long getOpen() {
        return open;
    }

    public void setOpen(long open) {
        this.open = open;
    }

    public long getInProgress() {
        return inProgress;
    }

    public void setInProgress(long inProgress) {
        this.inProgress = inProgress;
    }

    public long getWaitingCustomer() {
        return waitingCustomer;
    }

    public void setWaitingCustomer(long waitingCustomer) {
        this.waitingCustomer = waitingCustomer;
    }

    public long getResolved() {
        return resolved;
    }

    public void setResolved(long resolved) {
        this.resolved = resolved;
    }

    public long getClosed() {
        return closed;
    }

    public void setClosed(long closed) {
        this.closed = closed;
    }

    public long getOverdue() {
        return overdue;
    }

    public void setOverdue(long overdue) {
        this.overdue = overdue;
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
