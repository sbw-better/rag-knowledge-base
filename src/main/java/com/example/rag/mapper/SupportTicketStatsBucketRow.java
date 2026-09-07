package com.example.rag.mapper;

/**
 * 售后工单分布统计行。
 */
public class SupportTicketStatsBucketRow {
    private String name;
    private long total;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }
}
