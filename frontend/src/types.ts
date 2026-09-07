export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
};

export type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type UserResponse = {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
};

export type AuthResponse = {
  token: string;
  user: UserResponse;
};

export type AdminUserResponse = {
  id: string;
  email: string;
  displayName: string;
  enabled: boolean;
  roles: string[];
  createdAt: string;
};

export type UpdateUserRolesRequest = {
  roles: string[];
};

export type TenantResponse = {
  id: string;
  name: string;
  userCount: number;
  knowledgeBaseCount: number;
  createdAt: string;
};

export type TenantRequest = {
  name: string;
};

export type AuditLogResponse = {
  id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
};

export type KnowledgeBaseRequest = {
  name: string;
  description?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  minScore?: number;
};

export type KnowledgeBaseResponse = {
  id: string;
  name: string;
  description: string | null;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  minScore: number;
  createdAt: string;
  manageable: boolean;
  permission: string;
  canManageDocuments: boolean;
  canManageMembers: boolean;
  canManageConfig: boolean;
  canManageOperations: boolean;
  canDelete: boolean;
};

export type KnowledgeBaseMemberResponse = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  permission: string;
  createdAt: string;
};

export type KnowledgeBaseMemberRequest = {
  userId: string;
  permission: "VIEWER" | "EDITOR" | "MANAGER";
};

export type DocumentResponse = {
  id: string;
  knowledgeBaseId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

export type TaskResponse = {
  id: string;
  documentId: string | null;
  knowledgeBaseId: string | null;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  errorMessage: string | null;
  cancelRequested: boolean;
  lockedAt: string | null;
  startedAt: string | null;
  createdAt: string;
  finishedAt: string | null;
};

export type UploadResponse = {
  document: DocumentResponse;
  task: TaskResponse;
};

export type DocumentItem = {
  document: DocumentResponse;
  task: TaskResponse | null;
};

export type TaskListItem = {
  task: TaskResponse;
  knowledgeBaseName: string | null;
  documentFileName: string | null;
};

export type TaskStatsResponse = {
  total: number;
  pending: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  cancelRequested: number;
  ingestDocument: number;
  rebuildKnowledgeBaseIndex: number;
  averageDurationMs: number;
  maxDurationMs: number;
};

export type DocumentChunkResponse = {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  metadataJson: string | null;
  createdAt: string;
};

export type SearchMode = "VECTOR" | "KEYWORD" | "HYBRID";

export type SearchHit = {
  chunkId: string;
  documentId: string;
  fileName: string;
  chunkIndex: number;
  content: string;
  score: number;
  source: string;
};

export type SearchResponse = {
  hits: SearchHit[];
};

export type Citation = {
  documentId: string;
  chunkId: string;
  fileName: string;
  chunkIndex: number;
  score: number;
  snippet: string;
};

export type ChatResponse = {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  answer: string;
  answerStatus?: "ANSWERED" | "EMPTY_KB" | "NO_CONTEXT" | "CASUAL";
  citations: Citation[];
};

export type SupportTicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";

export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

export type SupportTicketRequest = {
  knowledgeBaseId: string;
  assigneeId?: string | null;
  ticketNo?: string;
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  category: string;
  channel: string;
  customerName: string;
  customerTier?: string;
  customerContact?: string;
  orderNo?: string;
  orderStatus?: string;
  productName?: string;
  productSku?: string;
  purchasedAt?: string | null;
  dueAt?: string | null;
  issueSummary: string;
  customerQuestion: string;
  latestAiReply?: string | null;
};

export type SupportTicketResponse = {
  id: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  ticketNo: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  category: string;
  channel: string;
  customerName: string;
  customerTier: string | null;
  customerContact: string | null;
  orderNo: string | null;
  orderStatus: string | null;
  productName: string | null;
  productSku: string | null;
  purchasedAt: string | null;
  dueAt: string | null;
  overdue: boolean;
  dueSoon: boolean;
  issueSummary: string;
  customerQuestion: string;
  latestAiReply: string | null;
  aiConversationId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canWork: boolean;
  canClose: boolean;
  canReopen: boolean;
  allowedStatuses: SupportTicketStatus[];
};

export type SupportTicketEventType =
  | "CREATED"
  | "ASSIGNED"
  | "STATUS_CHANGED"
  | "INTERNAL_NOTE"
  | "CUSTOMER_MESSAGE"
  | "AGENT_REPLY_SENT"
  | "AI_REPLY_GENERATED"
  | "REPLY_SAVED"
  | "KNOWLEDGE_RECHECK";

export type SupportTicketEventResponse = {
  id: string;
  ticketId: string;
  actorId: string;
  actorName: string | null;
  eventType: SupportTicketEventType;
  fromStatus: SupportTicketStatus | null;
  toStatus: SupportTicketStatus | null;
  fromAssigneeId: string | null;
  fromAssigneeName: string | null;
  toAssigneeId: string | null;
  toAssigneeName: string | null;
  note: string | null;
  createdAt: string;
};

export type TicketAssistantReplyResponse = {
  ticket: SupportTicketResponse;
  chat: ChatResponse;
};

export type SupportTicketStatsBucketResponse = {
  name: string;
  total: number;
};

export type SupportTicketIssueRankResponse = {
  question: string;
  total: number;
  latestAt: string;
};

export type SupportTicketTrendResponse = {
  dateLabel: string;
  total: number;
  resolved: number;
  overdue: number;
  outgoingReplies: number;
};

export type SupportTicketAgentStatsResponse = {
  assigneeId: string | null;
  assigneeName: string;
  assignedTickets: number;
  openTickets: number;
  resolvedTickets: number;
  outgoingReplies: number;
  avgFirstResponseMinutes: number | null;
  slaAttainmentRate: number | null;
};

export type SupportTicketStatsResponse = {
  total: number;
  open: number;
  inProgress: number;
  waitingCustomer: number;
  resolved: number;
  closed: number;
  overdue: number;
  aiReplyGenerated: number;
  outgoingReplies: number;
  customerMessages: number;
  openKnowledgeIssues: number;
  noContextIssues: number;
  knowledgeHitRate: number | null;
  categoryDistribution: SupportTicketStatsBucketResponse[];
  channelDistribution: SupportTicketStatsBucketResponse[];
  priorityDistribution: SupportTicketStatsBucketResponse[];
  noAnswerQuestions: SupportTicketIssueRankResponse[];
  windowDays: number;
  previousTotal: number;
  totalChange: number;
  previousResolved: number;
  resolvedChange: number;
  previousOutgoingReplies: number;
  outgoingRepliesChange: number;
  avgFirstResponseMinutes: number | null;
  slaAttainmentRate: number | null;
  trend: SupportTicketTrendResponse[];
  agentStats: SupportTicketAgentStatsResponse[];
};

export type FeedbackRating = "HELPFUL" | "NOT_HELPFUL";

export type AnswerFeedbackResponse = {
  id: string;
  knowledgeBaseId: string;
  conversationId: string;
  userMessageId: string | null;
  assistantMessageId: string;
  rating: FeedbackRating;
  reason: string | null;
  comment: string | null;
  businessModule: string | null;
  businessEntityId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BusinessFeedbackLinksResponse = {
  issues: KnowledgeIssueResponse[];
  feedbacks: AnswerFeedbackResponse[];
};

export type KnowledgeIssueResponse = {
  rechecks: KnowledgeIssueRecheckResponse[];
  id: string;
  knowledgeBaseId: string;
  conversationId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  feedbackId: string | null;
  createdBy: string | null;
  source: "NO_CONTEXT" | "NEGATIVE_FEEDBACK";
  status: "OPEN" | "RESOLVED";
  question: string;
  answerSummary: string | null;
  reason: string | null;
  comment: string | null;
  businessModule: string | null;
  businessEntityId: string | null;
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeIssueRecheckResponse = {
  id: string;
  issueId: string;
  actorId: string;
  outcome: "CONTEXT_FOUND" | "NO_CONTEXT" | "FAILED";
  summary: string;
  hitCount: number;
  createdAt: string;
};

export type ChatStreamMeta = {
  conversationId: string;
  userMessageId: string;
  answerStatus?: ChatResponse["answerStatus"];
};

export type ChatStreamError = {
  message: string;
};

export type MessageItem = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  citations: Citation[];
};

export type ConversationResponse = {
  id: string;
  title: string;
  messages: MessageItem[];
};

export type ConversationSummaryResponse = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};
