export const auditActionLabels: Record<string, string> = {
  TENANT_CREATE: "创建租户",
  USER_ROLE_UPDATE: "调整用户角色",
  KNOWLEDGE_BASE_CREATE: "创建知识库",
  KNOWLEDGE_BASE_UPDATE: "更新知识库",
  KNOWLEDGE_BASE_DELETE: "删除知识库",
  KNOWLEDGE_BASE_MEMBER_SAVE: "保存成员授权",
  KNOWLEDGE_BASE_MEMBER_REMOVE: "移除成员授权",
  KNOWLEDGE_BASE_INDEX_REBUILD: "重建索引",
  KNOWLEDGE_BASE_INDEX_REBUILD_REQUEST: "请求重建索引",
  DOCUMENT_UPLOAD: "上传文档",
  DOCUMENT_REINGEST: "文档重入库",
  DOCUMENT_DELETE: "删除文档",
  TASK_RETRY: "重试任务",
  TASK_CANCEL: "取消任务",
  ANSWER_FEEDBACK_SUBMIT: "提交回答反馈",
  KNOWLEDGE_ISSUE_RESOLVE: "解决知识缺口",
  SUPPORT_TICKET_CREATE: "创建售后工单",
  SUPPORT_TICKET_UPDATE: "更新售后工单",
  SUPPORT_TICKET_ASSIGN: "分配售后工单",
  SUPPORT_TICKET_STATUS_CHANGE: "流转工单状态",
  SUPPORT_TICKET_NOTE: "添加工单备注",
  SUPPORT_TICKET_DEMO_CREATE: "生成演示工单",
  SUPPORT_TICKET_AI_REPLY: "生成工单回复"
};

export const auditTargetLabels: Record<string, string> = {
  TENANT: "租户",
  USER: "用户",
  KNOWLEDGE_BASE: "知识库",
  DOCUMENT: "文档",
  RAG_TASK: "任务",
  ANSWER_FEEDBACK: "回答反馈",
  KNOWLEDGE_ISSUE: "知识缺口",
  SUPPORT_TICKET: "售后工单"
};

export function auditActionLabel(action: string) {
  return auditActionLabels[action] ?? action;
}

export function auditTargetLabel(targetType: string | null) {
  return targetType ? auditTargetLabels[targetType] ?? targetType : "未知对象";
}
