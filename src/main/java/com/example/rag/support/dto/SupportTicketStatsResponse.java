package com.example.rag.support.dto;

import java.util.List;

/**
 * 售后运营看板统计响应。
 */
public record SupportTicketStatsResponse(
        long total,
        long open,
        long inProgress,
        long waitingCustomer,
        long resolved,
        long closed,
        long overdue,
        long aiReplyGenerated,
        long outgoingReplies,
        long customerMessages,
        long openKnowledgeIssues,
        long noContextIssues,
        Integer knowledgeHitRate,
        List<SupportTicketStatsBucketResponse> categoryDistribution,
        List<SupportTicketStatsBucketResponse> channelDistribution,
        List<SupportTicketStatsBucketResponse> priorityDistribution,
        List<SupportTicketIssueRankResponse> noAnswerQuestions,
        int windowDays,
        long previousTotal,
        long totalChange,
        long previousResolved,
        long resolvedChange,
        long previousOutgoingReplies,
        long outgoingRepliesChange,
        Integer avgFirstResponseMinutes,
        Integer slaAttainmentRate,
        List<SupportTicketTrendResponse> trend,
        List<SupportTicketAgentStatsResponse> agentStats
) {
}
