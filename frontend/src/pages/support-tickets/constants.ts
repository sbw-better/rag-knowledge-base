import type { SupportTicketEventResponse, SupportTicketPriority, SupportTicketStatus } from "../../types";

export const PAGE_SIZE = 8;

export const statusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "待处理",
  IN_PROGRESS: "处理中",
  WAITING_CUSTOMER: "待客户",
  RESOLVED: "已解决",
  CLOSED: "已关闭"
};

export const priorityLabels: Record<SupportTicketPriority, string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急"
};

export const eventLabels: Record<SupportTicketEventResponse["eventType"], string> = {
  CREATED: "创建工单",
  ASSIGNED: "负责人变更",
  STATUS_CHANGED: "状态流转",
  INTERNAL_NOTE: "内部备注",
  AI_REPLY_GENERATED: "AI 生成回复",
  REPLY_SAVED: "保存回复"
};

export const statusOptions: Array<SupportTicketStatus | ""> = ["", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
export const priorityOptions: Array<SupportTicketPriority | ""> = ["", "URGENT", "HIGH", "NORMAL", "LOW"];
export const workflowStatuses: SupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
