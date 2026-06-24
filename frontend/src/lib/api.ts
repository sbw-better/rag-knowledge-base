import axios, { AxiosError } from "axios";
import { clearAuth, getToken, setAuth } from "./auth";
import type {
  ApiResponse,
  AuthResponse,
  ChatResponse,
  ConversationResponse,
  DocumentItem,
  DocumentResponse,
  KnowledgeBaseRequest,
  KnowledgeBaseResponse,
  SearchMode,
  SearchResponse,
  TaskResponse,
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
  if (value && typeof value === "object" && "success" in value && "data" in value) {
    const body = value as ApiResponse<unknown>;
    if (Array.isArray(body.data)) {
      return body.data as T[];
    }
  }
  throw new ApiError(`${label}接口返回格式异常，请刷新页面或检查后端接口响应。`, undefined, limitDetails(JSON.stringify(value)));
}

function limitDetails(value: string) {
  return value.length > 1200 ? `${value.slice(0, 1200)}...` : value;
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

  async listKnowledgeBases() {
    const data = await apiClient.get<unknown, unknown>("/knowledge-bases");
    return normalizeArray<KnowledgeBaseResponse>(data, "知识库列表");
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

  uploadDocument(knowledgeBaseId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post<unknown, UploadResponse>(`/knowledge-bases/${knowledgeBaseId}/documents`, formData);
  },

  async listKnowledgeBaseDocuments(knowledgeBaseId: string) {
    const data = await apiClient.get<unknown, unknown>(`/knowledge-bases/${knowledgeBaseId}/documents`);
    return normalizeArray<DocumentItem>(data, "文档列表");
  },

  getDocument(id: string) {
    return apiClient.get<unknown, DocumentResponse>(`/documents/${id}`);
  },

  getTask(id: string) {
    return apiClient.get<unknown, TaskResponse>(`/tasks/${id}`);
  },

  search(payload: { knowledgeBaseId: string; query: string; mode: SearchMode; topK?: number }) {
    return apiClient.post<unknown, SearchResponse>("/search", payload);
  },

  chat(payload: { knowledgeBaseId: string; conversationId?: string; question: string; topK?: number }) {
    return apiClient.post<unknown, ChatResponse>("/chat", payload);
  },

  getConversation(id: string) {
    return apiClient.get<unknown, ConversationResponse>(`/conversations/${id}`);
  }
};
