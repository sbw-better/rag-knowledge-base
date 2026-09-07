import axios, { AxiosError } from "axios";
import { clearAuth, getToken, setAuth } from "./auth";
import type {
  ApiResponse,
  AuditLogResponse,
  AnswerFeedbackResponse,
  AuthResponse,
  AdminUserResponse,
  BusinessFeedbackLinksResponse,
  ChatResponse,
  ChatStreamError,
  ChatStreamMeta,
  ConversationResponse,
  ConversationSummaryResponse,
  DocumentChunkResponse,
  DocumentItem,
  DocumentResponse,
  FeedbackRating,
  KnowledgeIssueResponse,
  KnowledgeBaseRequest,
  KnowledgeBaseMemberRequest,
  KnowledgeBaseMemberResponse,
  KnowledgeBaseResponse,
  PageResponse,
  SearchMode,
  SearchResponse,
  SupportTicketEventResponse,
  SupportTicketPriority,
  SupportTicketRequest,
  SupportTicketResponse,
  SupportTicketStatsResponse,
  SupportTicketStatus,
  TenantRequest,
  TenantResponse,
  TicketAssistantReplyResponse,
  TaskListItem,
  TaskResponse,
  TaskStatsResponse,
  UpdateUserRolesRequest,
  UploadResponse,
  UserResponse
} from "../types";

/**
 * 前端统一 API 错误对象。
 *
 * status 用于页面判断权限/登录态，details 保留后端原始错误，requestId 用于和后端日志关联。
 */
export class ApiError extends Error {
  status?: number;
  details?: string;
  requestId?: string;
  isNetworkError?: boolean;

  constructor(message: string, status?: number, details?: string, isNetworkError?: boolean) {
    super(message);
    this.status = status;
    this.details = details;
    this.isNetworkError = isNetworkError;
    this.requestId = details?.match(/错误编号：([0-9a-f-]+)/i)?.[1] ?? message.match(/错误编号：([0-9a-f-]+)/i)?.[1];
  }
}

/**
 * 将后端原始错误翻译成用户可理解的提示。
 * 这里不改变 details，方便开发人员展开查看真实异常。
 */
function friendlyBackendMessage(message: string, status?: number) {
  if (status === 401) {
    return "登录已过期，请重新登录。";
  }
  if (status === 403) {
    return "没有权限访问该资源。";
  }
  if (status === 404) {
    return "资源不存在或已被删除。";
  }
  if (status === 413) {
    return "上传文件过大，请压缩文件或调整后端上传限制。";
  }
  if (message.includes("无法连接模型服务") || message.includes("Connection timed out") || message.includes("api.openai.com")) {
    return "无法连接模型服务，请检查模型地址、API Key、代理或网络连通性。";
  }
  if (message.includes("HTTP 401") || message.toLowerCase().includes("api key")) {
    return "模型 API Key 不可用，请检查环境变量配置。";
  }
  if (message.includes("HTTP 429") || message.toLowerCase().includes("quota")) {
    return "模型服务额度或调用频率受限，请稍后重试或检查账户额度。";
  }
  if (status && status >= 500) {
    return "服务器处理失败，请查看后端日志或稍后重试。";
  }
  return message || "请求失败，请稍后重试。";
}

function toApiError(message: string | null | undefined, status?: number) {
  const raw = message || "请求失败";
  const friendly = friendlyBackendMessage(raw, status);
  return new ApiError(friendly, status, raw === friendly ? undefined : limitDetails(raw));
}

function toAxiosApiError(error: AxiosError<ApiResponse<unknown>>) {
  const status = error.response?.status;
  if (error.code === "ECONNABORTED") {
    return new ApiError("请求超时，后端或模型服务响应过慢。", status, error.message, true);
  }
  if (!error.response) {
    return new ApiError("无法连接后端服务，请确认 Spring Boot 已启动且前端代理地址正确。", status, error.message, true);
  }
  return toApiError(error.response.data?.error || error.message, status);
}

/**
 * 列表接口的防御性归一化。
 *
 * Vite 代理失效或后端响应结构变化时，接口可能返回 HTML 或对象。这里主动抛出可读错误，
 * 避免页面直接对非数组执行 map 导致白屏。
 */
function normalizeArray<T>(value: unknown, label: string): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (value && typeof value === "object" && "items" in value && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items;
  }
  if (value && typeof value === "object" && "success" in value && "data" in value) {
    const body = value as ApiResponse<unknown>;
    if (Array.isArray(body.data)) {
      return body.data as T[];
    }
    if (body.data && typeof body.data === "object" && "items" in body.data && Array.isArray((body.data as { items?: unknown }).items)) {
      return (body.data as { items: T[] }).items;
    }
  }
  throw new ApiError(`${label}接口返回格式异常，请刷新页面或检查后端接口响应。`, undefined, limitDetails(JSON.stringify(value)));
}

function normalizePage<T>(value: unknown, label: string): PageResponse<T> {
  if (value && typeof value === "object" && "items" in value && Array.isArray((value as { items?: unknown }).items)) {
    return value as PageResponse<T>;
  }
  if (Array.isArray(value)) {
    return {
      items: value as T[],
      page: 1,
      pageSize: value.length,
      total: value.length,
      totalPages: 1
    };
  }
  if (value && typeof value === "object" && "success" in value && "data" in value) {
    return normalizePage<T>((value as ApiResponse<unknown>).data, label);
  }
  throw new ApiError(`${label}接口返回分页格式异常，请刷新页面或检查后端接口响应。`, undefined, limitDetails(JSON.stringify(value)));
}

function limitDetails(value: string) {
  return value.length > 1200 ? `${value.slice(0, 1200)}...` : value;
}

function apiUrl(path: string) {
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  return `${base.replace(/\/$/, "")}${path}`;
}

type ChatStreamHandlers = {
  onMeta?: (data: ChatStreamMeta) => void;
  onDelta?: (content: string) => void;
  onDone?: (data: ChatResponse) => void;
  onError?: (data: ChatStreamError) => void;
};

type PageParams = {
  page: number;
  pageSize: number;
  keyword?: string;
};

function parseSseBlock(block: string) {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of block.replace(/\r/g, "").split("\n")) {
    if (rawLine.startsWith("event:")) {
      event = rawLine.slice("event:".length).trim();
    }
    if (rawLine.startsWith("data:")) {
      dataLines.push(rawLine.slice("data:".length).trimStart());
    }
  }
  return { event, data: dataLines.join("\n") };
}

function dispatchChatStreamEvent(event: string, data: string, handlers: ChatStreamHandlers) {
  if (!data) {
    return false;
  }
  const parsed = JSON.parse(data);
  if (event === "meta") {
    handlers.onMeta?.(parsed as ChatStreamMeta);
  } else if (event === "delta") {
    handlers.onDelta?.(String((parsed as { content?: string }).content ?? ""));
  } else if (event === "done") {
    handlers.onDone?.(parsed as ChatResponse);
    return true;
  } else if (event === "error") {
    handlers.onError?.(parsed as ChatStreamError);
    throw toApiError((parsed as ChatStreamError).message || "流式问答失败");
  }
  return false;
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 60000
});

// 请求拦截器统一注入 JWT，避免每个页面重复处理 Authorization header。
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器统一解包后端 ApiResponse，并处理 401 登录态失效。
apiClient.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === "object" && "success" in body) {
      if (!body.success) {
        throw toApiError(body.error, response.status);
      }
      return body.data;
    }
    return response.data;
  },
  (error: AxiosError<ApiResponse<unknown>>) => {
    if (error.response?.status === 401) {
      clearAuth();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    throw toAxiosApiError(error);
  }
);

/**
 * 后端 API 门面。页面层只依赖这里的方法，不直接使用 axios。
 */
export const api = {
  async register(payload: { email: string; password: string; displayName: string }) {
    const data = await apiClient.post<unknown, AuthResponse>("/auth/register", payload);
    setAuth(data.token, data.user);
    return data;
  },

  async login(payload: { email: string; password: string }) {
    const data = await apiClient.post<unknown, AuthResponse>("/auth/login", payload);
    setAuth(data.token, data.user);
    return data;
  },

  me() {
    return apiClient.get<unknown, UserResponse>("/auth/me");
  },

  async listAdminUsers() {
    const data = await apiClient.get<unknown, unknown>("/admin/users");
    return normalizeArray<AdminUserResponse>(data, "用户列表");
  },

  async listAdminUsersPage(params: PageParams) {
    const data = await apiClient.get<unknown, unknown>("/admin/users", { params });
    return normalizePage<AdminUserResponse>(data, "用户列表");
  },

  updateUserRoles(id: string, payload: UpdateUserRolesRequest) {
    return apiClient.patch<unknown, AdminUserResponse>(`/admin/users/${id}/roles`, payload);
  },

  async listTenants() {
    const data = await apiClient.get<unknown, unknown>("/admin/tenants");
    return normalizeArray<TenantResponse>(data, "租户列表");
  },

  async listAuditLogsPage(params: PageParams & { tenantId?: string; action?: string }) {
    const data = await apiClient.get<unknown, unknown>("/admin/audit-logs", { params });
    return normalizePage<AuditLogResponse>(data, "审计日志");
  },

  createTenant(payload: TenantRequest) {
    return apiClient.post<unknown, TenantResponse>("/admin/tenants", payload);
  },

  async listKnowledgeBases() {
    const data = await apiClient.get<unknown, unknown>("/knowledge-bases");
    return normalizeArray<KnowledgeBaseResponse>(data, "知识库列表");
  },

  async listKnowledgeBasesPage(params: PageParams) {
    const data = await apiClient.get<unknown, unknown>("/knowledge-bases", { params });
    return normalizePage<KnowledgeBaseResponse>(data, "知识库列表");
  },

  getKnowledgeBase(id: string) {
    return apiClient.get<unknown, KnowledgeBaseResponse>(`/knowledge-bases/${id}`);
  },

  createKnowledgeBase(payload: KnowledgeBaseRequest) {
    return apiClient.post<unknown, KnowledgeBaseResponse>("/knowledge-bases", payload);
  },

  updateKnowledgeBase(id: string, payload: KnowledgeBaseRequest) {
    return apiClient.patch<unknown, KnowledgeBaseResponse>(`/knowledge-bases/${id}`, payload);
  },

  deleteKnowledgeBase(id: string) {
    return apiClient.delete<unknown, null>(`/knowledge-bases/${id}`);
  },

  async listKnowledgeBaseMembers(id: string) {
    const data = await apiClient.get<unknown, unknown>(`/knowledge-bases/${id}/members`);
    return normalizeArray<KnowledgeBaseMemberResponse>(data, "知识库成员列表");
  },

  async listKnowledgeBaseMemberCandidates(id: string) {
    const data = await apiClient.get<unknown, unknown>(`/knowledge-bases/${id}/member-candidates`);
    return normalizeArray<AdminUserResponse>(data, "可授权用户列表");
  },

  saveKnowledgeBaseMember(id: string, payload: KnowledgeBaseMemberRequest) {
    return apiClient.post<unknown, KnowledgeBaseMemberResponse>(`/knowledge-bases/${id}/members`, payload);
  },

  removeKnowledgeBaseMember(id: string, userId: string) {
    return apiClient.delete<unknown, null>(`/knowledge-bases/${id}/members/${userId}`);
  },

  rebuildKnowledgeBaseIndex(id: string) {
    return apiClient.post<unknown, TaskResponse>(`/knowledge-bases/${id}/rebuild-index`);
  },

  uploadDocument(knowledgeBaseId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<unknown, UploadResponse>(`/knowledge-bases/${knowledgeBaseId}/documents`, formData);
  },

  async listKnowledgeBaseDocuments(knowledgeBaseId: string) {
    const data = await apiClient.get<unknown, unknown>(`/knowledge-bases/${knowledgeBaseId}/documents`);
    return normalizeArray<DocumentItem>(data, "文档列表");
  },

  async listKnowledgeBaseDocumentsPage(knowledgeBaseId: string, params: PageParams) {
    const data = await apiClient.get<unknown, unknown>(`/knowledge-bases/${knowledgeBaseId}/documents`, { params });
    return normalizePage<DocumentItem>(data, "文档列表");
  },

  getDocument(id: string) {
    return apiClient.get<unknown, DocumentResponse>(`/documents/${id}`);
  },

  async listDocumentChunks(id: string) {
    const data = await apiClient.get<unknown, unknown>(`/documents/${id}/chunks`);
    return normalizeArray<DocumentChunkResponse>(data, "文档切片列表");
  },

  reingestDocument(id: string) {
    return apiClient.post<unknown, TaskResponse>(`/documents/${id}/reingest`);
  },

  deleteDocument(id: string) {
    return apiClient.delete<unknown, null>(`/documents/${id}`);
  },

  getTask(id: string) {
    return apiClient.get<unknown, TaskResponse>(`/tasks/${id}`);
  },

  async listTasksPage(params: PageParams & { knowledgeBaseId: string; type?: string; status?: string }) {
    const data = await apiClient.get<unknown, unknown>("/tasks", { params });
    return normalizePage<TaskListItem>(data, "任务列表");
  },

  getTaskStats(knowledgeBaseId: string) {
    return apiClient.get<unknown, TaskStatsResponse>("/tasks/stats", { params: { knowledgeBaseId } });
  },

  retryTask(id: string) {
    return apiClient.post<unknown, TaskResponse>(`/tasks/${id}/retry`);
  },

  retryTasks(taskIds: string[]) {
    return apiClient.post<{ taskIds: string[] }, TaskResponse[]>("/tasks/batch/retry", { taskIds });
  },

  cancelTask(id: string) {
    return apiClient.post<unknown, TaskResponse>(`/tasks/${id}/cancel`);
  },

  cancelTasks(taskIds: string[]) {
    return apiClient.post<{ taskIds: string[] }, TaskResponse[]>("/tasks/batch/cancel", { taskIds });
  },

  search(payload: { knowledgeBaseId: string; query: string; mode: SearchMode; topK?: number }) {
    return apiClient.post<unknown, SearchResponse>("/search", payload);
  },

  submitAnswerFeedback(payload: {
    assistantMessageId: string;
    userMessageId?: string;
    rating: FeedbackRating;
    reason?: string;
    comment?: string;
    question?: string;
    businessModule?: string;
    businessEntityId?: string;
  }) {
    return apiClient.post<unknown, AnswerFeedbackResponse>("/knowledge-feedback/answer-feedback", payload);
  },

  async listKnowledgeIssuesPage(params: PageParams & { knowledgeBaseId: string; status?: "OPEN" | "RESOLVED" }) {
    const data = await apiClient.get<unknown, unknown>("/knowledge-feedback/issues", { params });
    return normalizePage<KnowledgeIssueResponse>(data, "知识缺口");
  },

  resolveKnowledgeIssue(id: string, resolutionNote?: string) {
    return apiClient.post<unknown, KnowledgeIssueResponse>(`/knowledge-feedback/issues/${id}/resolve`, { resolutionNote });
  },

  recheckKnowledgeIssue(id: string) {
    return apiClient.post<unknown, KnowledgeIssueResponse>(`/knowledge-feedback/issues/${id}/recheck`);
  },

  getBusinessFeedbackLinks(params: { knowledgeBaseId: string; businessModule: string; businessEntityId: string; limit?: number }) {
    return apiClient.get<unknown, BusinessFeedbackLinksResponse>("/knowledge-feedback/business-links", { params });
  },

  async listSupportTicketsPage(params: PageParams & {
    knowledgeBaseId?: string;
    status?: SupportTicketStatus | "";
    priority?: SupportTicketPriority | "";
    mine?: boolean;
    overdue?: boolean;
  }) {
    const data = await apiClient.get<unknown, unknown>("/support-tickets", { params });
    return normalizePage<SupportTicketResponse>(data, "售后工单");
  },

  getSupportTicket(id: string) {
    return apiClient.get<unknown, SupportTicketResponse>(`/support-tickets/${id}`);
  },

  getSupportTicketStats(days?: number) {
    return apiClient.get<unknown, SupportTicketStatsResponse>("/support-tickets/stats", { params: { days } });
  },

  async listSupportTicketEvents(id: string) {
    const data = await apiClient.get<unknown, unknown>(`/support-tickets/${id}/events`);
    return normalizeArray<SupportTicketEventResponse>(data, "工单时间线");
  },

  createSupportTicket(payload: SupportTicketRequest) {
    return apiClient.post<unknown, SupportTicketResponse>("/support-tickets", payload);
  },

  updateSupportTicket(id: string, payload: SupportTicketRequest) {
    return apiClient.patch<unknown, SupportTicketResponse>(`/support-tickets/${id}`, payload);
  },

  assignSupportTicket(id: string, assigneeId?: string | null, note?: string) {
    return apiClient.post<unknown, SupportTicketResponse>(`/support-tickets/${id}/assign`, { assigneeId, note });
  },

  changeSupportTicketStatus(id: string, status: SupportTicketStatus, note?: string) {
    return apiClient.post<unknown, SupportTicketResponse>(`/support-tickets/${id}/status`, { status, note });
  },

  closeSupportTicket(id: string, note?: string) {
    return apiClient.post<unknown, SupportTicketResponse>(`/support-tickets/${id}/close`, { note });
  },

  reopenSupportTicket(id: string, note?: string) {
    return apiClient.post<unknown, SupportTicketResponse>(`/support-tickets/${id}/reopen`, { note });
  },

  addSupportTicketNote(id: string, content: string) {
    return apiClient.post<unknown, SupportTicketEventResponse>(`/support-tickets/${id}/notes`, { content });
  },

  addSupportTicketCustomerMessage(id: string, content: string) {
    return apiClient.post<unknown, SupportTicketEventResponse>(`/support-tickets/${id}/customer-messages`, { content });
  },

  sendSupportTicketReply(id: string, content: string) {
    return apiClient.post<unknown, SupportTicketResponse>(`/support-tickets/${id}/outgoing-replies`, { content });
  },

  createDemoSupportTickets(knowledgeBaseId: string) {
    return apiClient.post<unknown, SupportTicketResponse[]>("/support-tickets/demo", { knowledgeBaseId });
  },

  generateSupportTicketReply(id: string, instruction?: string) {
    return apiClient.post<unknown, TicketAssistantReplyResponse>(`/support-tickets/${id}/assistant-reply`, { instruction });
  },

  chat(payload: {
    knowledgeBaseId: string;
    conversationId?: string;
    question: string;
    topK?: number;
    businessModule?: string;
    businessEntityId?: string;
    businessContext?: string;
  }) {
    return apiClient.post<unknown, ChatResponse>("/chat", payload);
  },

  async streamChat(
    payload: {
      knowledgeBaseId: string;
      conversationId?: string;
      question: string;
      topK?: number;
      businessModule?: string;
      businessEntityId?: string;
      businessContext?: string;
    },
    handlers: ChatStreamHandlers,
    signal?: AbortSignal
  ) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream"
    };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(apiUrl("/chat/stream"), {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal
    });
    if (response.status === 401) {
      clearAuth();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
      throw toApiError("登录已过期，请重新登录。", 401);
    }
    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => response.statusText);
      throw toApiError(errorText || response.statusText, response.status);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let separator = buffer.match(/\r?\n\r?\n/);
      while (separator?.index !== undefined) {
        const block = buffer.slice(0, separator.index);
        buffer = buffer.slice(separator.index + separator[0].length);
        const parsed = parseSseBlock(block);
        if (dispatchChatStreamEvent(parsed.event, parsed.data, handlers)) {
          await reader.cancel();
          return;
        }
        separator = buffer.match(/\r?\n\r?\n/);
      }
    }
    if (buffer.trim()) {
      const parsed = parseSseBlock(buffer);
      dispatchChatStreamEvent(parsed.event, parsed.data, handlers);
    }
  },

  getConversation(id: string) {
    return apiClient.get<unknown, ConversationResponse>(`/conversations/${id}`);
  },

  getLatestConversation(knowledgeBaseId: string) {
    return apiClient.get<unknown, ConversationResponse | null>("/conversations/latest", { params: { knowledgeBaseId } });
  },

  async listConversations(knowledgeBaseId: string) {
    const data = await apiClient.get<unknown, unknown>("/conversations", { params: { knowledgeBaseId } });
    return normalizeArray<ConversationSummaryResponse>(data, "会话列表");
  },

  async listConversationsPage(knowledgeBaseId: string, params: PageParams) {
    const data = await apiClient.get<unknown, unknown>("/conversations", { params: { knowledgeBaseId, ...params } });
    return normalizePage<ConversationSummaryResponse>(data, "会话列表");
  },

  renameConversation(id: string, title: string) {
    return apiClient.patch<unknown, ConversationSummaryResponse>(`/conversations/${id}`, { title });
  },

  deleteConversation(id: string) {
    return apiClient.delete<unknown, null>(`/conversations/${id}`);
  }
};
