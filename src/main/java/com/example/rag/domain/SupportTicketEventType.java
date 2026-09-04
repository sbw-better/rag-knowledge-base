package com.example.rag.domain;

/**
 * 售后工单时间线事件类型。
 */
public enum SupportTicketEventType {
    CREATED,
    ASSIGNED,
    STATUS_CHANGED,
    INTERNAL_NOTE,
    AI_REPLY_GENERATED,
    REPLY_SAVED
}
