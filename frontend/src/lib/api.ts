import axios, { AxiosError } from "axios";
import { clearAuth, getToken, setAuth } from "./auth";
import type {
  ApiResponse,
  AuthResponse,
  ChatResponse,
  ConversationResponse,
  DocumentResponse,
  KnowledgeBaseRequest,
  KnowledgeBaseResponse,
  SearchMode,
  SearchResponse,
  TaskResponse,
  UploadResponse,
  UserResponse
} from "../types";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  timeout: 60000
});

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === "object" && "success" in body) {
      if (!body.success) {
        throw new ApiError(body.error || "请求失败", response.status);
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
    const message = error.response?.data?.error || error.message || "网络请求失败";
    throw new ApiError(message, error.response?.status);
  }
);

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

  listKnowledgeBases() {
    return apiClient.get<unknown, KnowledgeBaseResponse[]>("/knowledge-bases");
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
