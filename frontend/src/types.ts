export type ApiResponse<T> = {
  success: boolean;
  data: T;
  error: string | null;
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

export type KnowledgeBaseRequest = {
  name: string;
  description?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
};

export type KnowledgeBaseResponse = {
  id: string;
  name: string;
  description: string | null;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  createdAt: string;
  manageable: boolean;
  permission: string;
  canManageDocuments: boolean;
  canManageMembers: boolean;
  canManageConfig: boolean;
  canManageOperations: boolean;
  canDelete: boolean;
};

export type RebuildIndexResponse = {
  knowledgeBaseId: string;
  chunkCount: number;
  rebuiltCount: number;
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
  documentId: string;
  type: string;
  status: string;
  attempts: number;
  errorMessage: string | null;
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
  answerStatus?: "ANSWERED" | "EMPTY_KB" | "NO_CONTEXT";
  citations: Citation[];
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
