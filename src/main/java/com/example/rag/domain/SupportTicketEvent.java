package com.example.rag.domain;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;

import java.time.Instant;

/**
 * 售后工单处理时间线事件。
 */
@TableName("support_ticket_events")
public class SupportTicketEvent {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long tenantId;
    private Long ticketId;
    private Long actorId;
    private SupportTicketEventType eventType;
    private SupportTicketStatus fromStatus;
    private SupportTicketStatus toStatus;
    private Long fromAssigneeId;
    private Long toAssigneeId;
    private String note;
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getTenantId() {
        return tenantId;
    }

    public void setTenantId(Long tenantId) {
        this.tenantId = tenantId;
    }

    public Long getTicketId() {
        return ticketId;
    }

    public void setTicketId(Long ticketId) {
        this.ticketId = ticketId;
    }

    public Long getActorId() {
        return actorId;
    }

    public void setActorId(Long actorId) {
        this.actorId = actorId;
    }

    public SupportTicketEventType getEventType() {
        return eventType;
    }

    public void setEventType(SupportTicketEventType eventType) {
        this.eventType = eventType;
    }

    public SupportTicketStatus getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(SupportTicketStatus fromStatus) {
        this.fromStatus = fromStatus;
    }

    public SupportTicketStatus getToStatus() {
        return toStatus;
    }

    public void setToStatus(SupportTicketStatus toStatus) {
        this.toStatus = toStatus;
    }

    public Long getFromAssigneeId() {
        return fromAssigneeId;
    }

    public void setFromAssigneeId(Long fromAssigneeId) {
        this.fromAssigneeId = fromAssigneeId;
    }

    public Long getToAssigneeId() {
        return toAssigneeId;
    }

    public void setToAssigneeId(Long toAssigneeId) {
        this.toAssigneeId = toAssigneeId;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
