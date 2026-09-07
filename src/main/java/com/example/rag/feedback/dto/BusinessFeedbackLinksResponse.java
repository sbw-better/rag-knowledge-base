package com.example.rag.feedback.dto;

import java.util.List;

/**
 * 业务对象关联的问答反馈闭环数据。
 */
public record BusinessFeedbackLinksResponse(
        List<KnowledgeIssueResponse> issues,
        List<AnswerFeedbackResponse> feedbacks
) {
}
