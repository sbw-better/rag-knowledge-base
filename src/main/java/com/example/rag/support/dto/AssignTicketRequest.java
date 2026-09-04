package com.example.rag.support.dto;

/**
 * 工单分配请求。assigneeId 为空表示取消负责人。
 */
public record AssignTicketRequest(String assigneeId, String note) {
}
