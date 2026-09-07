package com.example.rag.support.dto;

import java.time.Instant;

/**
 * 售后工单无答案问题排行项。
 */
public record SupportTicketIssueRankResponse(String question, long total, Instant latestAt) {
}
