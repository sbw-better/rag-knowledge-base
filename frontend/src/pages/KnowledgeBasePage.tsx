import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  Check,
  FileText,
  Hammer,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldAlert,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Label, PageHeader, Pagination, Panel, PanelHeader, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { cn, formatBytes, formatDateTime, shortId } from "../lib/utils";
import type {
  Citation,
  ChatResponse,
  ConversationSummaryResponse,
  DocumentChunkResponse,
  DocumentItem,
  DocumentResponse,
  KnowledgeBaseMemberRequest,
  MessageItem,
  SearchHit,
  SearchMode,
  TaskListItem,
  TaskResponse,
  TaskStatsResponse
} from "../types";

type Tab = "documents" | "search" | "chat" | "members" | "config" | "operations";
type RecentUpload = {
  document: DocumentResponse;
  task: TaskResponse;
};
const DOCUMENT_PAGE_SIZE = 8;
const CONVERSATION_PAGE_SIZE = 10;
const TASK_PAGE_SIZE = 8;
type ChatItem = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  answerStatus?: ChatResponse["answerStatus"];
  citations?: Citation[];
  streaming?: boolean;
};

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".html", ".htm"];

const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "documents", label: "文档", icon: FileText },
  { id: "search", label: "检索", icon: Search },
  { id: "chat", label: "问答", icon: MessageSquare },
  { id: "members", label: "成员", icon: Users },
  { id: "config", label: "配置", icon: Settings },
  { id: "operations", label: "运维", icon: ShieldAlert }
];

function uploadStorageKey(kbId: string) {
  return `ragkb.uploads.${kbId}`;
}

/**
 * 读取本地最近上传记录。
 *
 * <p>后端已有真实文档列表后，本地记录只作为兼容旧数据的辅助状态；展示以
 * GET /knowledge-bases/{id}/documents 的返回为准。</p>
 */
function getStoredUploads(kbId: string): RecentUpload[] {
  const raw = localStorage.getItem(uploadStorageKey(kbId));
  if (!raw) {
    return [];
  }
  try {
    return (JSON.parse(raw) as RecentUpload[])
      .filter((item) => item.document.knowledgeBaseId === kbId);
  } catch {
    return [];
  }
}

function setStoredUploads(kbId: string, uploads: RecentUpload[]) {
  const scopedUploads = uploads
    .filter((item) => item.document.knowledgeBaseId === kbId)
    .slice(0, 20);
  localStorage.setItem(uploadStorageKey(kbId), JSON.stringify(scopedUploads));
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error || "");
}

function UploadErrorMessage({ error }: { error: unknown }) {
  if (!error) {
    return null;
  }
  const message = errorText(error);
  const requestId = message.match(/错误编号：([0-9a-f-]+)/i)?.[1];
  const isServerError = message.includes("Internal error") || message.includes("服务器处理失败") || message.includes("/documents");
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
      <p className="font-medium">{isServerError ? "上传失败，后端处理文件时出错。" : message}</p>
      {isServerError ? (
        <p className="mt-1 text-xs leading-5 text-rose-600">
          请查看后端日志定位原因{requestId ? `，错误编号：${requestId}` : ""}。常见原因包括 MinIO 连接、文件解析或数据库写入异常。
        </p>
      ) : null}
    </div>
  );
}

/**
 * 上传前校验。后端仍会做最终校验，前端校验用于提前给出更快、更友好的反馈。
 */
function validateUploadFile(file: File) {
  const lowerName = file.name.toLowerCase();
  const isAllowed = ALLOWED_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  if (!isAllowed) {
    return `暂不支持该文件类型，请上传 ${ALLOWED_UPLOAD_EXTENSIONS.join("、")} 文件。`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `文件不能超过 ${formatBytes(MAX_UPLOAD_BYTES)}，请压缩或拆分后再上传。`;
  }
  if (file.size === 0) {
    return "文件内容为空，请选择有效文档。";
  }
  return "";
}

/**
 * 将后端任务错误归类为用户能理解的标题。
 */
function taskErrorTitle(message: string) {
  if (message.includes("无法连接模型服务") || message.includes("Connection timed out") || message.includes("api.openai.com")) {
    return "向量生成失败：无法连接模型服务";
  }
  if (message.includes("HTTP 401") || message.includes("API Key")) {
    return "向量生成失败：模型 API Key 不可用";
  }
  if (message.includes("HTTP 429") || message.includes("quota") || message.includes("余额")) {
    return "向量生成失败：模型额度或频率受限";
  }
  if (message.includes("Embedding")) {
    return "向量生成失败";
  }
  return "文档处理失败";
}

function statusTone(status: string): "slate" | "green" | "amber" | "rose" | "cyan" {
  if (status === "COMPLETED" || status === "READY" || status === "SUCCEEDED" || status === "INDEXED") {
    return "green";
  }
  if (status === "FAILED") {
    return "rose";
  }
  if (status === "PROCESSING" || status === "RUNNING") {
    return "cyan";
  }
  if (status === "PENDING") {
    return "amber";
  }
  return "slate";
}

export default function KnowledgeBasePage() {
  const { id } = useParams();
  const kbId = id ?? "";
  const [activeTab, setActiveTab] = useState<Tab>("documents");

  const kbQuery = useQuery({
    queryKey: ["knowledge-base", kbId],
    queryFn: () => api.getKnowledgeBase(kbId),
    enabled: Boolean(kbId)
  });
  const kb = kbQuery.data;
  const canManageDocuments = Boolean(kb?.canManageDocuments);
  const canManageMembers = Boolean(kb?.canManageMembers);
  const canManageConfig = Boolean(kb?.canManageConfig);
  const canUseOperations = Boolean(kb?.canManageOperations || kb?.canDelete);
  const manageable = Boolean(kb?.manageable);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => {
      if (tab.id === "chat") {
        return true;
      }
      if (tab.id === "documents" || tab.id === "search") {
        return canManageDocuments;
      }
      if (tab.id === "members") {
        return canManageMembers;
      }
      if (tab.id === "config") {
        return canManageConfig;
      }
      if (tab.id === "operations") {
        return canUseOperations;
      }
      return false;
    }),
    [canManageConfig, canManageDocuments, canManageMembers, canUseOperations]
  );

  useEffect(() => {
    if (kbQuery.data && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("chat");
    }
  }, [activeTab, kbQuery.data, visibleTabs]);

  return (
    <div className="mx-auto max-w-7xl min-w-0 max-w-full p-4 lg:p-8">
      <PageHeader
        eyebrow="知识库工作台"
        title={kbQuery.data?.name ?? "正在加载..."}
        description={kbQuery.data?.description || "未填写描述"}
        actions={
          kbQuery.data && manageable ? (
            <>
              <Badge tone="slate">{kbQuery.data.permission}</Badge>
              <Badge tone="green">TopK {kbQuery.data.topK}</Badge>
              <Badge tone="cyan">Chunk {kbQuery.data.chunkSize}</Badge>
              <Badge>Overlap {kbQuery.data.chunkOverlap}</Badge>
            </>
          ) : null
        }
      />

      <div className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm shadow-slate-900/5">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
                activeTab === tab.id
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <ErrorMessage error={kbQuery.error} />
      {activeTab === "documents" && canManageDocuments ? <DocumentsPanel kbId={kbId} /> : null}
      {activeTab === "search" && canManageDocuments ? <SearchPanel kbId={kbId} defaultTopK={kbQuery.data?.topK ?? 5} /> : null}
      {activeTab === "chat" ? <ChatPanel kbId={kbId} defaultTopK={kbQuery.data?.topK ?? 5} /> : null}
      {activeTab === "members" && kbQuery.data && canManageMembers ? <MembersPanel kbId={kbQuery.data.id} /> : null}
      {activeTab === "config" && kbQuery.data && canManageConfig ? <KnowledgeBaseConfigPanel kb={kbQuery.data} /> : null}
      {activeTab === "operations" && kbQuery.data && canUseOperations ? <OperationsPanel kb={kbQuery.data} /> : null}
    </div>
  );
}

function DocumentsPanel({ kbId }: { kbId: string }) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<RecentUpload[]>(() => getStoredUploads(kbId));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidationError, setFileValidationError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [chunkDocumentId, setChunkDocumentId] = useState<string | undefined>();
  const [documentKeyword, setDocumentKeyword] = useState("");
  const [documentPage, setDocumentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["knowledge-base-documents-page", kbId, documentPage, DOCUMENT_PAGE_SIZE, documentKeyword],
    queryFn: () => api.listKnowledgeBaseDocumentsPage(kbId, { page: documentPage, pageSize: DOCUMENT_PAGE_SIZE, keyword: documentKeyword }),
    enabled: Boolean(kbId),
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((item) => item.task && !["SUCCEEDED", "FAILED", "CANCELLED"].includes(item.task.status)) ? 3000 : false;
    }
  });

  useEffect(() => {
    setUploads(getStoredUploads(kbId));
    setSelectedFile(null);
    setFileValidationError("");
    setIsDragging(false);
    setChunkDocumentId(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [kbId]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) {
        throw new Error("请选择要上传的文档");
      }
      if (fileValidationError) {
        throw new Error(fileValidationError);
      }
      return api.uploadDocument(kbId, selectedFile);
    },
    onSuccess: (data) => {
      setUploads((current) => {
        const next = [{ document: data.document, task: data.task }, ...current]
          .filter((item) => item.document.knowledgeBaseId === kbId);
        setStoredUploads(kbId, next);
        return next;
      });
      setSelectedFile(null);
      setFileValidationError("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setDocumentPage(1);
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents-page", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents", kbId] });
    }
  });

  const chunksQuery = useQuery({
    queryKey: ["document-chunks", chunkDocumentId],
    queryFn: () => api.listDocumentChunks(chunkDocumentId!),
    enabled: Boolean(chunkDocumentId)
  });

  const selectedChunkDocument = useMemo(
    () => documentsQuery.data?.items.find((item) => item.document.id === chunkDocumentId)?.document,
    [chunkDocumentId, documentsQuery.data]
  );
  const documents = documentsQuery.data?.items ?? [];
  const totalDocuments = documentsQuery.data?.total ?? 0;
  const documentTotalPages = documentsQuery.data?.totalPages ?? 1;
  const safeDocumentPage = documentsQuery.data?.page ?? documentPage;

  useEffect(() => {
    setDocumentPage(1);
  }, [documentKeyword]);

  useEffect(() => {
    if (documentPage > documentTotalPages) {
      setDocumentPage(documentTotalPages);
    }
  }, [documentPage, documentTotalPages]);

  const reingestMutation = useMutation({
    mutationFn: (documentId: string) => api.reingestDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents-page", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents", kbId] });
    }
  });

  const retryTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.retryTask(taskId),
    onSuccess: (task) => {
      replaceTask(task);
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents-page", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents", kbId] });
    }
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (documentId: string) => api.deleteDocument(documentId),
    onSuccess: (_, documentId) => {
      if (chunkDocumentId === documentId) {
        setChunkDocumentId(undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents-page", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-documents", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases-page"] });
    }
  });

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setSelectedFile(file);
    setFileValidationError(validateUploadFile(file));
    uploadMutation.reset();
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function replaceTask(task: TaskResponse) {
    setUploads((current) => {
      const next = current
        .map((item) => (item.task.id === task.id ? { ...item, task } : item))
        .filter((item) => item.document.knowledgeBaseId === kbId);
      setStoredUploads(kbId, next);
      return next;
    });
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Panel className="h-fit">
        <PanelHeader title="上传文档" description="支持后端已接入的 PDF、DOCX、TXT、Markdown、HTML。" />
        <div className="space-y-4 p-5">
          <div
            className={cn(
              "flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition",
              isDragging ? "border-emerald-500 bg-emerald-100/70" : "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50"
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-3 h-7 w-7 text-emerald-700" />
            <span className="max-w-full truncate text-sm font-medium text-slate-800">{selectedFile ? selectedFile.name : "选择文件或拖拽到这里"}</span>
            <span className="mt-1 text-xs text-slate-500">{selectedFile ? formatBytes(selectedFile.size) : "上传后会自动创建入库任务"}</span>
            <Button className="mt-4" type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              选择文件
            </Button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown,.html,.htm"
              onChange={(event) => chooseFile(event.target.files?.[0])}
            />
          </div>
          <ErrorMessage error={fileValidationError ? new Error(fileValidationError) : undefined} />
          <UploadErrorMessage error={uploadMutation.error} />
          <Button className="w-full" disabled={!selectedFile || Boolean(fileValidationError) || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? "上传中..." : "上传并入库"}
          </Button>
        </div>
      </Panel>

      <Panel className="min-w-0">
        <PanelHeader
          title="文档任务"
          description="显示当前知识库下的真实文档和最近一次入库任务。"
          actions={<Badge tone="slate">{totalDocuments} 个文档</Badge>}
        />
        <div className="p-5">
          {documentsQuery.isLoading ? <div className="text-sm text-slate-500">正在加载文档...</div> : null}
          <ErrorMessage error={documentsQuery.error} />
          {totalDocuments > 0 || documentKeyword ? (
            <div className="relative mb-4 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={documentKeyword}
                onChange={(event) => setDocumentKeyword(event.target.value)}
                placeholder="搜索文件名或任务状态"
              />
            </div>
          ) : null}
          {totalDocuments === 0 && !documentKeyword ? (
            <EmptyState title="暂无文档" description="上传文档后，系统会创建入库任务并在这里显示处理状态。" />
          ) : totalDocuments === 0 ? (
            <EmptyState title="没有匹配文档" description="可以更换搜索关键词，或清空搜索条件。" />
          ) : (
            <div className="max-h-none space-y-3 overflow-y-visible pr-0 xl:max-h-[620px] xl:overflow-y-auto xl:pr-2">
              {documents.map((item) => (
                <TaskRow
                  key={item.document.id}
                  item={item}
                  selected={chunkDocumentId === item.document.id}
                  busy={reingestMutation.isPending || retryTaskMutation.isPending || deleteDocumentMutation.isPending}
                  onTaskChange={replaceTask}
                  onViewChunks={() => setChunkDocumentId((current) => current === item.document.id ? undefined : item.document.id)}
                  onReingest={() => reingestMutation.mutate(item.document.id)}
                  onRetryTask={() => item.task ? retryTaskMutation.mutate(item.task.id) : undefined}
                  onDelete={() => {
                    if (window.confirm(`确认删除文档「${item.document.fileName}」吗？历史回答中的相关引用也会被清理。`)) {
                      deleteDocumentMutation.mutate(item.document.id);
                    }
                  }}
                />
              ))}
            </div>
          )}
          <ErrorMessage error={reingestMutation.error || retryTaskMutation.error || deleteDocumentMutation.error} />
        </div>
        <Pagination page={safeDocumentPage} pageSize={DOCUMENT_PAGE_SIZE} total={totalDocuments} onPageChange={setDocumentPage} />
      </Panel>
      <DocumentChunksDrawer
        open={Boolean(chunkDocumentId)}
        document={selectedChunkDocument}
        chunks={chunksQuery.data ?? []}
        loading={chunksQuery.isLoading}
        error={chunksQuery.error}
        onClose={() => setChunkDocumentId(undefined)}
      />
    </div>
  );
}

function TaskRow({
  item,
  selected,
  busy,
  onTaskChange,
  onViewChunks,
  onReingest,
  onRetryTask,
  onDelete
}: {
  item: DocumentItem;
  selected: boolean;
  busy: boolean;
  onTaskChange: (task: TaskResponse) => void;
  onViewChunks: () => void;
  onReingest: () => void;
  onRetryTask: () => void;
  onDelete: () => void;
}) {
  const shouldPoll = Boolean(item.task && !["SUCCEEDED", "FAILED", "CANCELLED"].includes(item.task.status));
  const taskQuery = useQuery({
    queryKey: ["task", item.task?.id],
    queryFn: () => api.getTask(item.task!.id),
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 3000 : false
  });

  const task = taskQuery.data ?? item.task;
  const canRetryTask = task?.status === "FAILED";

  useEffect(() => {
    if (taskQuery.data && item.task && taskQuery.data.status !== item.task.status) {
      onTaskChange(taskQuery.data);
    }
  }, [item.task, onTaskChange, taskQuery.data]);

  return (
    <div className={cn("rounded-lg border bg-white px-4 py-3", selected ? "border-cyan-300 shadow-sm shadow-cyan-900/10" : "border-slate-200")}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.document.fileName}</p>
          <p className="mt-1 break-words text-xs text-slate-500">
            {formatBytes(item.document.sizeBytes)} · 文档 {shortId(item.document.id)}
            {task ? ` · 任务 ${shortId(task.id)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={statusTone(task?.status ?? item.document.status)}>{task?.status ?? item.document.status}</Badge>
          <Button type="button" variant="secondary" size="sm" onClick={onViewChunks}>
            {selected ? "查看中" : "查看切片"}
          </Button>
          {canRetryTask ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onRetryTask}>
              重试任务
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onReingest}>
            重入库
          </Button>
          <Button type="button" variant="danger" size="sm" disabled={busy} onClick={onDelete}>
            删除
          </Button>
        </div>
      </div>
      {task ? (
        <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
          <span>类型：{task.type}</span>
          <span>尝试：{task.attempts}/{task.maxAttempts}</span>
          <span>创建：{formatDateTime(task.createdAt)}</span>
          <span>开始：{formatDateTime(task.startedAt)}</span>
          <span>锁定：{formatDateTime(task.lockedAt)}</span>
          <span>完成：{formatDateTime(task.finishedAt)}</span>
        </div>
      ) : null}
      {task?.errorMessage ? (
        <details className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
          <summary className="cursor-pointer select-none font-medium">{taskErrorTitle(task.errorMessage)}</summary>
          <p className="mt-2 break-words text-rose-600">{task.errorMessage}</p>
          <p className="mt-2 text-rose-500">可以检查 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、网络代理，或先移除 API Key 使用本地 fallback 验证链路。</p>
        </details>
      ) : null}
    </div>
  );
}

function SearchPanel({ kbId, defaultTopK }: { kbId: string; defaultTopK: number }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("HYBRID");
  const [topK, setTopK] = useState(defaultTopK);
  const searchModes: Array<{ value: SearchMode; title: string; description: string }> = [
    { value: "HYBRID", title: "混合检索", description: "优先推荐，同时结合语义和关键词" },
    { value: "VECTOR", title: "语义检索", description: "适合意思相近但表达不同的问题" },
    { value: "KEYWORD", title: "关键词检索", description: "适合精确术语、编号、字段名称" }
  ];

  const searchMutation = useMutation({
    mutationFn: () => api.search({ knowledgeBaseId: kbId, query, mode, topK })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    searchMutation.mutate();
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
      <Panel className="h-fit overflow-hidden">
        <PanelHeader title="检索调试" description="用于验证文档切片和召回效果，参数只影响本次调试。" />
        <form onSubmit={submit} className="space-y-5 p-5">
          <Field label="问题或关键词">
            <Textarea
              className="min-h-32"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入要验证召回效果的问题，例如：退款多久到账？"
              required
            />
          </Field>

          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-slate-900">检索策略</h3>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">普通使用建议选择混合检索。</p>
              </div>
              <Badge tone="cyan">{mode}</Badge>
            </div>
            <div className="grid gap-2">
              {searchModes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    mode === item.value
                      ? "border-emerald-300 bg-white text-emerald-800 shadow-sm shadow-emerald-950/5 ring-1 ring-emerald-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/50"
                  )}
                  onClick={() => setMode(item.value)}
                >
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="本次召回数量">
                <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
              </Field>
              <p className="max-w-48 text-xs leading-5 text-slate-500">只影响这次调试，不会覆盖知识库默认配置。</p>
            </div>
          </section>

          <ErrorMessage error={searchMutation.error} />
          <Button className="w-full" type="submit" disabled={searchMutation.isPending}>
            <Search className="h-4 w-4" />
            {searchMutation.isPending ? "检索中..." : "开始检索"}
          </Button>
        </form>
      </Panel>

      <Panel className="min-w-0">
        <PanelHeader
          title="命中片段"
          description="展示召回来源、分数和文本内容。"
          actions={searchMutation.data ? <Badge tone="slate">{searchMutation.data.hits.length} 条结果</Badge> : null}
        />
        <div className="min-h-[420px] space-y-3 p-5">
          {searchMutation.data?.hits.length === 0 ? <EmptyState title="没有命中结果" description="可以尝试更换问题、模式或等待文档入库完成。" /> : null}
          {!searchMutation.data ? <EmptyState title="等待检索" description="提交一个问题后，这里会显示命中的文档片段。" /> : null}
          {searchMutation.data?.hits.map((hit) => (
            <SearchHitCard key={hit.chunkId} hit={hit} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SearchHitCard({ hit }: { hit: SearchHit }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-medium text-slate-900">{hit.fileName}</p>
          <p className="mt-0.5 text-xs text-slate-500">Chunk #{hit.chunkIndex} · {shortId(hit.chunkId)}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="cyan">{hit.source}</Badge>
          <Badge tone="green">{hit.score.toFixed(4)}</Badge>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{hit.content}</p>
    </article>
  );
}

function ChatPanel({ kbId, defaultTopK }: { kbId: string; defaultTopK: number }) {
  const queryClient = useQueryClient();
  const streamAbortRef = useRef<AbortController | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(() => readStoredConversationId(kbId));
  const [skipRestore, setSkipRestore] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const conversationQuery = useQuery({
    queryKey: ["chat-conversation", kbId, conversationId ?? "latest"],
    queryFn: () => (conversationId ? api.getConversation(conversationId) : api.getLatestConversation(kbId)),
    enabled: !skipRestore,
    retry: false
  });

  const conversationsQuery = useQuery({
    queryKey: ["chat-conversations", kbId, historyPage, CONVERSATION_PAGE_SIZE, historyKeyword],
    queryFn: () => api.listConversationsPage(kbId, { page: historyPage, pageSize: CONVERSATION_PAGE_SIZE, keyword: historyKeyword }),
    enabled: Boolean(kbId)
  });

  useEffect(() => {
    setConversationId(readStoredConversationId(kbId));
    setMessages([]);
    setSelectedAssistantId(undefined);
    setQuestion("");
    setHistoryOpen(false);
    setHistoryKeyword("");
    setHistoryPage(1);
    setSkipRestore(false);
  }, [kbId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyKeyword]);

  useEffect(() => {
    const totalPages = conversationsQuery.data?.totalPages ?? 1;
    if (historyPage > totalPages) {
      setHistoryPage(totalPages);
    }
  }, [conversationsQuery.data?.totalPages, historyPage]);

  useEffect(() => {
    if (!conversationQuery.isSuccess) {
      return;
    }
    const conversation = conversationQuery.data;
    if (!conversation) {
      if (!conversationId) {
        setMessages([]);
      }
      return;
    }
    setConversationId(conversation.id);
    storeConversationId(kbId, conversation.id);
    const restoredMessages = conversation.messages.map(toChatItem);
    setMessages(restoredMessages);
    setSelectedAssistantId(findLatestAssistantId(restoredMessages));
  }, [conversationQuery.data, conversationQuery.isSuccess, conversationId, kbId]);

  useEffect(() => {
    if (!conversationQuery.isError || !conversationId) {
      return;
    }
    removeStoredConversationId(kbId);
    setConversationId(undefined);
    setMessages([]);
    setSelectedAssistantId(undefined);
  }, [conversationId, conversationQuery.isError, kbId]);

  const chatMutation = useMutation({
    mutationFn: async (currentQuestion: string) => {
      const assistantTempId = `stream-${Date.now()}`;
      const controller = new AbortController();
      let doneReceived = false;
      let streamStarted = false;
      streamAbortRef.current = controller;
      setMessages((current) => [...current, { id: assistantTempId, role: "assistant", content: "", citations: [], streaming: true }]);
      try {
        await api.streamChat(
          { knowledgeBaseId: kbId, conversationId, question: currentQuestion, topK: defaultTopK },
          {
            onMeta: (data) => {
              streamStarted = true;
              setConversationId(data.conversationId);
              storeConversationId(kbId, data.conversationId);
            },
            onDelta: (content) => {
              if (!content) {
                return;
              }
              setMessages((current) =>
                current.map((item) => item.id === assistantTempId ? { ...item, content: `${item.content}${content}` } : item)
              );
            },
            onDone: (data: ChatResponse) => {
              doneReceived = true;
              setConversationId(data.conversationId);
              storeConversationId(kbId, data.conversationId);
              setSelectedAssistantId(data.assistantMessageId);
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantTempId
                    ? {
                        id: data.assistantMessageId,
                        role: "assistant",
                        content: data.answer,
                        answerStatus: data.answerStatus,
                        citations: data.citations,
                        streaming: false
                      }
                    : item
                )
              );
            }
          },
          controller.signal
        );
        if (!doneReceived) {
          throw new Error("流式回答没有正常结束，请稍后重试。");
        }
      } catch (error) {
        let finalError = error;
        if (!streamStarted && !controller.signal.aborted) {
          try {
            let data: ChatResponse;
            try {
              data = await api.chat({ knowledgeBaseId: kbId, conversationId, question: currentQuestion, topK: defaultTopK });
            } catch (fallbackError) {
              if (conversationId && isStaleConversationError(fallbackError)) {
                removeStoredConversationId(kbId);
                setConversationId(undefined);
                data = await api.chat({ knowledgeBaseId: kbId, question: currentQuestion, topK: defaultTopK });
              } else {
                throw fallbackError;
              }
            }
            setConversationId(data.conversationId);
            storeConversationId(kbId, data.conversationId);
            setSelectedAssistantId(data.assistantMessageId);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantTempId
                  ? {
                      id: data.assistantMessageId,
                      role: "assistant",
                      content: data.answer,
                      answerStatus: data.answerStatus,
                      citations: data.citations,
                      streaming: false
                    }
                  : item
              )
            );
            return;
          } catch (fallbackError) {
            finalError = fallbackError;
          }
        }
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantTempId
              ? { ...item, content: item.content || "回答生成失败，请稍后重试。", streaming: false }
            : item
          )
        );
        throw finalError;
      } finally {
        streamAbortRef.current = null;
        setSkipRestore(false);
      }
    },
    onSuccess: () => {
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["chat-conversations", kbId] });
    }
  });

  const renameConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations", kbId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", kbId, conversationId ?? "latest"] });
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations", kbId] });
      queryClient.removeQueries({ queryKey: ["chat-conversation", kbId, id] });
      if (conversationId === id) {
        resetConversation();
      }
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setQuestion("");
    setSkipRestore(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    chatMutation.mutate(trimmed);
  }

  function resetConversation() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    removeStoredConversationId(kbId);
    setConversationId(undefined);
    setMessages([]);
    setSelectedAssistantId(undefined);
    setQuestion("");
    setHistoryOpen(false);
    setHistoryKeyword("");
    setHistoryPage(1);
    setSkipRestore(true);
    chatMutation.reset();
    queryClient.removeQueries({ queryKey: ["chat-conversation", kbId] });
  }

  function switchConversation(nextConversationId: string) {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    chatMutation.reset();
    if (!nextConversationId) {
      resetConversation();
      return;
    }
    if (nextConversationId === conversationId) {
      setHistoryOpen(false);
      return;
    }
    setConversationId(nextConversationId);
    storeConversationId(kbId, nextConversationId);
    setMessages([]);
    setSelectedAssistantId(undefined);
    setHistoryOpen(false);
    setSkipRestore(false);
  }

  function renameConversation(conversation: ConversationSummaryResponse) {
    const currentTitle = conversation.title || `会话 ${shortId(conversation.id)}`;
    const nextTitle = window.prompt("请输入新的会话标题，便于后续在历史会话中搜索", currentTitle);
    if (nextTitle?.trim()) {
      renameConversationMutation.mutate({ id: conversation.id, title: nextTitle.trim() });
    }
  }

  function deleteConversation(conversation: ConversationSummaryResponse) {
    const title = conversation.title || `会话 ${shortId(conversation.id)}`;
    if (window.confirm(`确认删除会话「${title}」及其问答历史吗？删除后无法从前端恢复。`)) {
      deleteConversationMutation.mutate(conversation.id);
    }
  }

  const currentConversationTitle = conversationId
    ? conversationsQuery.data?.items.find((item) => item.id === conversationId)?.title ?? conversationQuery.data?.title ?? `会话 ${shortId(conversationId)}`
    : "新会话";
  const conversations = conversationsQuery.data?.items ?? [];
  const conversationTotal = conversationsQuery.data?.total ?? 0;
  const safeHistoryPage = conversationsQuery.data?.page ?? historyPage;

  const selectedAssistant = useMemo(
    () => messages.find((item) => item.role === "assistant" && item.id === selectedAssistantId)
      ?? [...messages].reverse().find((item) => item.role === "assistant"),
    [messages, selectedAssistantId]
  );
  const selectedCitations = selectedAssistant?.citations ?? [];

  function citationEmptyState() {
    if (!selectedAssistant) {
      return { title: "暂无引用", description: "选择一条回答后，这里会显示对应的来源片段。" };
    }
    if (selectedAssistant.answerStatus === "EMPTY_KB") {
      return { title: "知识库暂无资料", description: "当前知识库没有可引用的文档片段，请联系负责人上传并完成入库。" };
    }
    if (selectedAssistant.answerStatus === "NO_CONTEXT") {
      return { title: "这条回答未命中资料", description: "该问题没有检索到可引用片段，可以换个问法或补充相关文档。" };
    }
    return { title: "这条回答没有引用来源", description: "当前选中的回答没有返回可展示的来源片段。" };
  }

  const emptyCitationState = citationEmptyState();
  const isRestoringConversation = conversationQuery.isLoading && !skipRestore;
  const chatDescription = conversationId
    ? "本轮问答已开启，后续问题会延续当前上下文。"
    : "向当前知识库提问，回答会附带可核验的来源。";

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel className="min-w-0 min-h-[620px]">
        <PanelHeader
          title="知识库问答"
          description={chatDescription}
          actions={
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <div className="relative">
                <Button type="button" variant="secondary" size="sm" onClick={() => setHistoryOpen((current) => !current)}>
                  <MessageSquare className="h-4 w-4" />
                  历史会话
                </Button>
                {historyOpen ? (
                  <div className="absolute right-0 top-10 z-20 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
                    <div className="border-b border-slate-100 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">历史会话</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">当前：{currentConversationTitle}</p>
                        </div>
                        <button
                          type="button"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="关闭历史会话"
                          onClick={() => setHistoryOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="relative mt-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="h-9 pl-9 pr-9"
                          value={historyKeyword}
                          onChange={(event) => setHistoryKeyword(event.target.value)}
                          placeholder="搜索会话标题或编号"
                        />
                        {historyKeyword ? (
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="清空搜索"
                            onClick={() => setHistoryKeyword("")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {conversationsQuery.isLoading ? <p className="px-3 py-3 text-sm text-slate-500">正在加载会话...</p> : null}
                    {!conversationsQuery.isLoading && conversationTotal === 0 && !historyKeyword ? (
                      <p className="px-3 py-3 text-sm text-slate-500">暂无历史会话</p>
                    ) : null}
                    {!conversationsQuery.isLoading && conversationTotal === 0 && historyKeyword ? (
                      <p className="px-3 py-3 text-sm text-slate-500">没有找到匹配的会话</p>
                    ) : null}
                    <div className="max-h-72 overflow-y-auto p-2">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className={cn(
                            "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition",
                            conversation.id === conversationId
                              ? "bg-emerald-50 text-emerald-800"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                          )}
                          onClick={() => switchConversation(conversation.id)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{conversation.title || `会话 ${shortId(conversation.id)}`}</span>
                            <span className="mt-0.5 block text-xs text-slate-400">更新于 {formatDateTime(conversation.updatedAt)}</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-white hover:text-slate-900"
                              disabled={renameConversationMutation.isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                renameConversation(conversation);
                              }}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-xs text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                              disabled={deleteConversationMutation.isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteConversation(conversation);
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                    <Pagination
                      page={safeHistoryPage}
                      pageSize={CONVERSATION_PAGE_SIZE}
                      total={conversationTotal}
                      onPageChange={setHistoryPage}
                    />
                  </div>
                ) : null}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={resetConversation}>
                <MessageSquare className="h-4 w-4" />
                新建会话
              </Button>
            </div>
          }
        />
        <div className="flex h-[min(500px,calc(100vh-340px))] min-h-[420px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {isRestoringConversation ? <EmptyState title="正在恢复会话" description="正在加载你在当前知识库里的最近一次问答。" /> : null}
            {!isRestoringConversation && messages.length === 0 ? <EmptyState title="开始提问" description="可以直接描述你的问题，系统会从当前知识库中查找相关资料后回答。" /> : null}
            {messages.map((message, index) => (
              <div key={message.id ?? `${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <button
                  type="button"
                  disabled={message.role !== "assistant"}
                  onClick={() => message.role === "assistant" && message.id ? setSelectedAssistantId(message.id) : undefined}
                  className={cn(
                    "max-w-[min(760px,90%)] rounded-lg px-4 py-3 text-left text-sm leading-6 transition",
                    message.role === "user" && "cursor-default bg-emerald-600 text-white",
                    message.role === "assistant" && "border bg-white text-slate-800 hover:border-cyan-200 hover:bg-cyan-50/20",
                    message.role === "assistant" && message.id === selectedAssistant?.id
                      ? "border-cyan-300 shadow-sm shadow-cyan-900/10"
                      : message.role === "assistant" && "border-slate-200"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-700">
                      <span className="inline-flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        知识库助手
                      </span>
                      {message.answerStatus === "EMPTY_KB" ? <Badge tone="amber">知识库暂无资料</Badge> : null}
                      {message.answerStatus === "NO_CONTEXT" ? <Badge tone="slate">未命中资料</Badge> : null}
                      {message.streaming ? <Badge tone="cyan">生成中</Badge> : null}
                    </div>
                  ) : null}
                    <p className="whitespace-pre-wrap break-words">{message.content || (message.streaming ? "正在检索并生成回答..." : "")}</p>
                  {message.citations?.length ? (
                    <span className="mt-3 inline-flex max-w-full items-center gap-1 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800">
                      <span>查看 {message.citations.length} 个来源</span>
                      <span className="min-w-0 truncate text-cyan-700">· {summarizeCitationFiles(message.citations)}</span>
                    </span>
                  ) : null}
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="border-t border-slate-100 p-4">
            <ErrorMessage error={chatMutation.error} />
            <ErrorMessage error={renameConversationMutation.error || deleteConversationMutation.error} />
            <div className="mt-3 flex items-center gap-3">
              <Input
                className="h-12 min-w-0 text-base sm:text-sm"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="向当前知识库提问"
              />
              <Button
                className="h-12 min-w-24 shrink-0 whitespace-nowrap px-5"
                type="submit"
                disabled={chatMutation.isPending || isRestoringConversation || !question.trim()}
              >
                <Send className="h-4 w-4" />
                发送
              </Button>
            </div>
          </form>
        </div>
      </Panel>

      <Panel className="h-fit min-w-0">
        <PanelHeader title="回答来源" description="显示当前选中回答引用的文档片段。" />
        <div className="space-y-3 p-5">
          {selectedAssistant ? (
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-xs leading-5 text-cyan-800">
              当前查看：{selectedAssistant.content ? selectedAssistant.content.slice(0, 46) : "正在生成的回答"}
              {selectedAssistant.content.length > 46 ? "..." : ""}
            </div>
          ) : null}
          {selectedCitations.length === 0 ? <EmptyState title={emptyCitationState.title} description={emptyCitationState.description} /> : null}
          {selectedCitations.map((citation, index) => (
            <details key={`${citation.chunkId}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                来源 {index + 1} · {citation.fileName}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <div>Chunk #{citation.chunkIndex} · Score {citation.score.toFixed(4)}</div>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{citation.snippet}</p>
              </div>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function DocumentChunksDrawer({
  open,
  document,
  chunks,
  loading,
  error,
  onClose
}: {
  open: boolean;
  document?: DocumentResponse;
  chunks: DocumentChunkResponse[];
  loading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="文档切片详情">
      <button className="absolute inset-0 h-full w-full cursor-default" type="button" aria-label="关闭切片详情" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/15 sm:w-[min(760px,calc(100vw-4rem))]">
        <div className="flex min-w-0 items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-950">文档切片</h3>
              <Badge tone="cyan">{chunks.length} 个切片</Badge>
            </div>
            <p className="mt-1 truncate text-sm text-slate-600">{document?.fileName ?? "正在加载文档信息..."}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">用于检查解析和切分效果。切片很多时只在当前窗口内滚动，不影响文档任务列表。</p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <ErrorMessage error={error} />
          {loading ? <p className="text-sm text-slate-500">正在加载切片...</p> : null}
          {!loading && chunks.length === 0 ? <EmptyState title="暂无切片" description="文档完成入库后才会生成切片。" /> : null}
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <details key={chunk.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/5">
                <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">切片 #{chunk.chunkIndex}</summary>
                <p className="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                  {chunk.content}
                </p>
              </details>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function chatConversationStorageKey(kbId: string) {
  return `ragkb.chat.conversation.${kbId}`;
}

function readStoredConversationId(kbId: string) {
  return window.localStorage.getItem(chatConversationStorageKey(kbId)) ?? undefined;
}

function storeConversationId(kbId: string, conversationId: string) {
  window.localStorage.setItem(chatConversationStorageKey(kbId), conversationId);
}

function removeStoredConversationId(kbId: string) {
  window.localStorage.removeItem(chatConversationStorageKey(kbId));
}

function isStaleConversationError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
  return status === 403 || status === 404;
}

function findLatestAssistantId(messages: ChatItem[]) {
  return [...messages].reverse().find((item) => item.role === "assistant")?.id;
}

function toChatItem(message: MessageItem): ChatItem {
  return {
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content,
    citations: message.citations
  };
}

function summarizeCitationFiles(citations: Citation[]) {
  const files = Array.from(new Set(citations.map((citation) => citation.fileName).filter(Boolean)));
  if (files.length === 0) {
    return "查看来源";
  }
  if (files.length <= 2) {
    return files.join("、");
  }
  return `${files.slice(0, 2).join("、")} 等 ${files.length} 个文件`;
}

function MembersPanel({ kbId }: { kbId: string }) {
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberUserIds, setSelectedMemberUserIds] = useState<string[]>([]);
  const [memberPermission, setMemberPermission] = useState<KnowledgeBaseMemberRequest["permission"]>("VIEWER");
  const [grantResult, setGrantResult] = useState<{ total: number; failed: Array<{ userId: string; label: string; error: string }> } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["knowledge-base-member-candidates", kbId],
    queryFn: () => api.listKnowledgeBaseMemberCandidates(kbId)
  });

  const membersQuery = useQuery({
    queryKey: ["knowledge-base-members", kbId],
    queryFn: () => api.listKnowledgeBaseMembers(kbId)
  });

  const users = usersQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const memberUserIds = new Set(members.map((member) => member.userId));
  const availableUsers = users.filter((user) => user.enabled && !user.roles.includes("ADMIN") && !memberUserIds.has(user.id));
  const normalizedSearch = memberSearch.trim().toLowerCase();
  const filteredAvailableUsers = normalizedSearch
    ? availableUsers.filter((user) => `${user.displayName} ${user.email}`.toLowerCase().includes(normalizedSearch))
    : availableUsers;
  const visibleSelectedCount = filteredAvailableUsers.filter((user) => selectedMemberUserIds.includes(user.id)).length;
  const allVisibleSelected = filteredAvailableUsers.length > 0 && visibleSelectedCount === filteredAvailableUsers.length;

  const saveMembersMutation = useMutation({
    mutationFn: async () => {
      const targets = [...selectedMemberUserIds];
      const failed: Array<{ userId: string; label: string; error: string }> = [];
      await Promise.all(
        targets.map(async (userId) => {
          const targetUser = users.find((user) => user.id === userId);
          try {
            await api.saveKnowledgeBaseMember(kbId, { userId, permission: memberPermission });
          } catch (error) {
            failed.push({
              userId,
              label: targetUser ? `${targetUser.displayName} · ${targetUser.email}` : userId,
              error: errorText(error)
            });
          }
        })
      );
      return { total: targets.length, failed };
    },
    onSuccess: (result) => {
      setGrantResult(result);
      const failedUserIds = new Set(result.failed.map((item) => item.userId));
      setSelectedMemberUserIds((current) => current.filter((userId) => failedUserIds.has(userId)));
      if (result.failed.length === 0) {
        setMemberSearch("");
        setMemberPermission("VIEWER");
      }
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-members", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeKnowledgeBaseMember(kbId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-members", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

  function toggleMemberUser(userId: string) {
    setGrantResult(null);
    setSelectedMemberUserIds((current) => (
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    ));
  }

  function toggleVisibleUsers() {
    setGrantResult(null);
    const visibleIds = filteredAvailableUsers.map((user) => user.id);
    if (allVisibleSelected) {
      setSelectedMemberUserIds((current) => current.filter((userId) => !visibleIds.includes(userId)));
      return;
    }
    setSelectedMemberUserIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  return (
    <div className="min-w-0 space-y-5">
      <Panel className="min-w-0">
        <PanelHeader
          title="成员与访问权限"
          description="控制哪些非管理员用户可以访问当前知识库；管理员无需单独授权。"
          actions={<Badge tone="slate">当前成员 {members.length}</Badge>}
        />
        <div className="space-y-4 p-5">
          <ErrorMessage error={usersQuery.error || membersQuery.error || removeMemberMutation.error} />
          {grantResult ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                grantResult.failed.length === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {grantResult.failed.length === 0 ? (
                <p>已成功授权 {grantResult.total} 个用户。</p>
              ) : (
                <details open>
                  <summary className="cursor-pointer select-none">
                    已处理 {grantResult.total} 个用户，其中 {grantResult.failed.length} 个失败。
                  </summary>
                  <div className="mt-2 space-y-1 text-xs leading-5">
                    {grantResult.failed.map((item) => (
                      <p key={item.userId} className="break-words">
                        {item.label}：{item.error}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : null}

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
              <div className="space-y-4 border-b border-slate-100 p-4">
                <div>
                  <Label>授权角色</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      { value: "VIEWER", label: "只读问答", description: "仅可使用问答" },
                      { value: "EDITOR", label: "资料维护", description: "维护文档资料" },
                      { value: "MANAGER", label: "知识库管理", description: "成员、配置、索引" }
                    ] as Array<{ value: KnowledgeBaseMemberRequest["permission"]; label: string; description: string }>).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={cn(
                          "min-w-0 rounded-lg border px-3 py-2 text-left transition",
                          memberPermission === item.value
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                        onClick={() => {
                          setGrantResult(null);
                          setMemberPermission(item.value);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        <span className="block truncate text-xs">{item.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <Field label="待授权用户">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-9"
                        value={memberSearch}
                        placeholder="按用户名或邮箱搜索"
                        onChange={(event) => {
                          setGrantResult(null);
                          setMemberSearch(event.target.value);
                        }}
                      />
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" disabled={filteredAvailableUsers.length === 0} onClick={toggleVisibleUsers}>
                      {allVisibleSelected ? "取消全选" : "全选当前"}
                    </Button>
                    {selectedMemberUserIds.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGrantResult(null);
                          setSelectedMemberUserIds([]);
                        }}
                      >
                        清空
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="min-w-28"
                      disabled={selectedMemberUserIds.length === 0 || saveMembersMutation.isPending}
                      onClick={() => saveMembersMutation.mutate()}
                    >
                      <UserPlus className="h-4 w-4" />
                      {saveMembersMutation.isPending ? "授权中..." : selectedMemberUserIds.length > 0 ? `授权 ${selectedMemberUserIds.length} 人` : "选择后授权"}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  {memberSearch.trim() ? `当前筛选 ${filteredAvailableUsers.length} 人` : `可选用户 ${availableUsers.length} 人`}
                  <span className="mx-1 text-slate-300">/</span>
                  已选 <span className="font-medium text-emerald-700">{selectedMemberUserIds.length}</span> 人
                </p>
              </div>

              <div className="max-h-[440px] space-y-2 overflow-y-auto p-3">
                {usersQuery.isLoading ? <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">正在加载用户...</p> : null}
                {!usersQuery.isLoading && filteredAvailableUsers.length === 0 ? (
                  <EmptyState title="没有可授权用户" description="可能所有普通用户都已授权，或当前搜索条件没有匹配结果。ADMIN 不需要知识库成员授权。" />
                ) : null}
                {filteredAvailableUsers.map((user) => {
                  const checked = selectedMemberUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-lg border bg-white p-3 text-left transition",
                        checked ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40"
                      )}
                      onClick={() => toggleMemberUser(user.id)}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded border",
                          checked ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{user.displayName}</span>
                        <span className="block truncate text-xs text-slate-500">{user.email}</span>
                      </span>
                      <Badge tone={user.roles.includes("ADMIN") ? "rose" : user.roles.includes("KB_MANAGER") ? "cyan" : "slate"}>
                        {user.roles.includes("ADMIN") ? "ADMIN" : user.roles.includes("KB_MANAGER") ? "KB_MANAGER" : "USER"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">已授权成员</h3>
                  <p className="mt-0.5 text-xs text-slate-500">这些用户可以访问当前知识库。</p>
                </div>
                <Badge tone="slate">{members.length} 人</Badge>
              </div>
              <div className="max-h-[440px] space-y-2 overflow-y-auto p-3">
                {membersQuery.isLoading ? <p className="text-sm text-slate-500">正在加载成员...</p> : null}
                {!membersQuery.isLoading && members.length === 0 ? <EmptyState title="暂无授权成员" description="从左侧选择用户后，可以批量授权进入当前知识库。" /> : null}
                {members.map((member) => (
                  <div key={member.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{member.displayName}</p>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={member.permission === "MANAGER" ? "green" : member.permission === "EDITOR" ? "cyan" : "slate"}>{member.permission}</Badge>
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="移除授权"
                        disabled={removeMemberMutation.isPending}
                        onClick={() => {
                          setGrantResult(null);
                          removeMemberMutation.mutate(member.userId);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function KnowledgeBaseConfigPanel({ kb }: { kb: { id: string; name: string; description: string | null; chunkSize: number; chunkOverlap: number; topK: number; minScore: number } }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description ?? "");
  const [chunkSize, setChunkSize] = useState(kb.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(kb.chunkOverlap);
  const [topK, setTopK] = useState(kb.topK);
  const [minScore, setMinScore] = useState(kb.minScore ?? 0);

  const updateMutation = useMutation({
    mutationFn: () => api.updateKnowledgeBase(kb.id, { name, description, chunkSize, chunkOverlap, topK, minScore }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kb.id] });
    }
  });

  return (
    <Panel className="min-w-0">
      <PanelHeader title="知识库配置" description="这里维护知识库的基础信息和默认参数。普通问答用户不会看到这些配置。" />
      <form
        className="grid min-w-0 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate();
        }}
      >
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">基础信息</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">用于区分业务场景，会展示给有权限访问该知识库的成员。</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <Field label="知识库名称">
                <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
              </Field>
              <Field label="业务说明">
                <Textarea className="min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">默认参数</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">影响后续入库切分和默认问答召回，不展示给普通问答用户。</p>
              </div>
              <Badge tone="cyan">维护人员可见</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="切片长度">
                <Input type="number" min={200} max={4000} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} />
              </Field>
              <Field label="重叠长度">
                <Input type="number" min={0} max={1000} value={chunkOverlap} onChange={(event) => setChunkOverlap(Number(event.target.value))} />
              </Field>
              <Field label="默认召回数">
                <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
              </Field>
              <Field label="最低相关度">
                <Input type="number" min={0} max={1} step={0.01} value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} />
              </Field>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-sm font-semibold text-slate-900">参数说明</h3>
            <dl className="mt-3 space-y-3 text-xs leading-5 text-slate-500">
              <div>
                <dt className="font-medium text-slate-700">切片长度</dt>
                <dd>单个文档片段的大致长度。数值越大，片段包含上下文越多，但召回粒度更粗。</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">重叠长度</dt>
                <dd>相邻片段保留的重叠长度，用于减少切片边界导致的语义断裂。</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">默认召回数</dt>
                <dd>问答默认召回的片段数量。检索调试页里的临时召回数不会覆盖这里。</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">最低相关度</dt>
                <dd>最低召回分数。0 表示不过滤；适当提高可以减少不相关问题也显示来源的情况。</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">保存修改</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">保存后会影响后续上传入库、检索和问答默认召回。</p>
            <ErrorMessage error={updateMutation.error} />
            <Button className="mt-4 w-full" type="submit" disabled={updateMutation.isPending}>
              <RefreshCw className="h-4 w-4" />
              {updateMutation.isPending ? "保存中..." : "保存配置"}
            </Button>
          </section>
        </aside>
      </form>
    </Panel>
  );
}

function OperationsPanel({ kb }: { kb: { id: string; name: string; canManageOperations: boolean; canDelete: boolean } }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [taskPage, setTaskPage] = useState(1);
  const [taskKeyword, setTaskKeyword] = useState("");
  const [taskType, setTaskType] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());

  const rebuildMutation = useMutation({
    mutationFn: () => api.rebuildKnowledgeBaseIndex(kb.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task-stats", kb.id] });
    }
  });
  const rebuildTaskId = rebuildMutation.data?.id;
  const rebuildTaskQuery = useQuery({
    queryKey: ["task", rebuildTaskId],
    queryFn: () => api.getTask(rebuildTaskId!),
    enabled: Boolean(rebuildTaskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !["SUCCEEDED", "FAILED", "CANCELLED"].includes(status) ? 3000 : false;
    }
  });
  const rebuildTask = rebuildTaskQuery.data ?? rebuildMutation.data;
  const tasksQuery = useQuery({
    queryKey: ["tasks", kb.id, taskPage, TASK_PAGE_SIZE, taskKeyword, taskType, taskStatus],
    queryFn: () => api.listTasksPage({
      knowledgeBaseId: kb.id,
      page: taskPage,
      pageSize: TASK_PAGE_SIZE,
      keyword: taskKeyword,
      type: taskType || undefined,
      status: taskStatus || undefined
    }),
    enabled: kb.canManageOperations,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? [];
      return items.some((item) => !["SUCCEEDED", "FAILED", "CANCELLED"].includes(item.task.status)) ? 3000 : false;
    }
  });
  const taskStatsQuery = useQuery({
    queryKey: ["task-stats", kb.id],
    queryFn: () => api.getTaskStats(kb.id),
    enabled: kb.canManageOperations,
    refetchInterval: (query) => {
      const stats = query.state.data;
      return stats && (stats.running > 0 || stats.cancelRequested > 0) ? 3000 : false;
    }
  });
  const retryTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.retryTask(taskId),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task-stats", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    }
  });
  const cancelTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.cancelTask(taskId),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task-stats", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task", task.id] });
    }
  });
  const retryTasksMutation = useMutation({
    mutationFn: (taskIds: string[]) => api.retryTasks(taskIds),
    onSuccess: (tasks) => {
      setSelectedTaskIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["tasks", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task-stats", kb.id] });
      tasks.forEach((task) => queryClient.invalidateQueries({ queryKey: ["task", task.id] }));
    }
  });
  const cancelTasksMutation = useMutation({
    mutationFn: (taskIds: string[]) => api.cancelTasks(taskIds),
    onSuccess: (tasks) => {
      setSelectedTaskIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["tasks", kb.id] });
      queryClient.invalidateQueries({ queryKey: ["task-stats", kb.id] });
      tasks.forEach((task) => queryClient.invalidateQueries({ queryKey: ["task", task.id] }));
    }
  });
  const selectedTaskQuery = useQuery({
    queryKey: ["task", selectedTaskId],
    queryFn: () => api.getTask(selectedTaskId!),
    enabled: Boolean(selectedTaskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && !["SUCCEEDED", "FAILED", "CANCELLED"].includes(status) ? 3000 : false;
    }
  });
  const taskItems = tasksQuery.data?.items ?? [];
  const taskTotal = tasksQuery.data?.total ?? 0;
  const taskTotalPages = tasksQuery.data?.totalPages ?? 1;
  const safeTaskPage = tasksQuery.data?.page ?? taskPage;
  const taskBusy = retryTaskMutation.isPending || cancelTaskMutation.isPending || retryTasksMutation.isPending || cancelTasksMutation.isPending;
  const selectedTaskItems = useMemo(
    () => taskItems.filter((item) => selectedTaskIds.has(item.task.id)),
    [selectedTaskIds, taskItems]
  );
  const retryableSelectedTaskIds = useMemo(
    () => selectedTaskItems.filter((item) => item.task.status === "FAILED").map((item) => item.task.id),
    [selectedTaskItems]
  );
  const cancellableSelectedTaskIds = useMemo(
    () => selectedTaskItems
      .filter((item) => ["PENDING", "RUNNING"].includes(item.task.status) && !item.task.cancelRequested)
      .map((item) => item.task.id),
    [selectedTaskItems]
  );
  const allCurrentPageSelected = taskItems.length > 0 && taskItems.every((item) => selectedTaskIds.has(item.task.id));

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteKnowledgeBase(kb.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      navigate("/app/knowledge-bases", { replace: true });
    }
  });

  useEffect(() => {
    setTaskPage(1);
  }, [taskKeyword, taskType, taskStatus]);

  useEffect(() => {
    if (taskPage > taskTotalPages) {
      setTaskPage(taskTotalPages);
    }
  }, [taskPage, taskTotalPages]);

  useEffect(() => {
    const visibleIds = new Set(taskItems.map((item) => item.task.id));
    setSelectedTaskIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [taskItems]);

  function toggleTaskSelected(taskId: string) {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  function toggleCurrentPageSelected() {
    setSelectedTaskIds((current) => {
      const next = new Set(current);
      if (allCurrentPageSelected) {
        taskItems.forEach((item) => next.delete(item.task.id));
      } else {
        taskItems.forEach((item) => next.add(item.task.id));
      }
      return next;
    });
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
      {kb.canManageOperations ? (
        <div className="space-y-5">
          <Panel className="h-fit">
            <PanelHeader title="索引维护" description="从 MySQL 切片重新生成向量并写入 Milvus。通常只在模型维度、索引异常或历史数据修复时使用。" />
            <div className="space-y-4 p-5">
              <ErrorMessage error={rebuildMutation.error} />
              {rebuildTask ? (
                <div className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  rebuildTask.status === "FAILED" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-emerald-100 bg-emerald-50 text-emerald-700"
                )}>
                  <div className="font-medium">索引重建任务 {shortId(rebuildTask.id)}：{rebuildTask.status}</div>
                  <div className="mt-1 text-xs">
                    尝试 {rebuildTask.attempts}/{rebuildTask.maxAttempts} · 创建 {formatDateTime(rebuildTask.createdAt)}
                    {rebuildTask.finishedAt ? ` · 完成 ${formatDateTime(rebuildTask.finishedAt)}` : ""}
                  </div>
                  {rebuildTask.errorMessage ? <div className="mt-1 break-words text-xs">{rebuildTask.errorMessage}</div> : null}
                </div>
              ) : null}
              <Button
                variant="secondary"
                disabled={rebuildMutation.isPending}
                onClick={() => {
                  if (window.confirm("确认创建当前知识库的 Milvus 向量索引重建任务吗？数据量较大时会在后台执行。")) {
                    rebuildMutation.mutate();
                  }
                }}
              >
                <Hammer className="h-4 w-4" />
                {rebuildMutation.isPending ? "创建任务中..." : "创建重建任务"}
              </Button>
            </div>
          </Panel>

          <Panel className="min-w-0">
            <PanelHeader
              title="任务中心"
              description="查看当前知识库的文档入库和索引维护任务。"
              actions={<Badge tone="slate">{taskTotal} 个任务</Badge>}
            />
            <div className="space-y-4 p-5">
              <ErrorMessage error={tasksQuery.error || taskStatsQuery.error || retryTaskMutation.error || cancelTaskMutation.error || retryTasksMutation.error || cancelTasksMutation.error} />
              <TaskStatsOverview stats={taskStatsQuery.data} loading={taskStatsQuery.isLoading} />
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={taskKeyword} onChange={(event) => setTaskKeyword(event.target.value)} placeholder="搜索任务、文档或状态" />
                </div>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  value={taskType}
                  onChange={(event) => setTaskType(event.target.value)}
                >
                  <option value="">全部类型</option>
                  <option value="INGEST_DOCUMENT">文档入库</option>
                  <option value="REBUILD_KNOWLEDGE_BASE_INDEX">索引重建</option>
                </select>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  value={taskStatus}
                  onChange={(event) => setTaskStatus(event.target.value)}
                >
                  <option value="">全部状态</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RUNNING">RUNNING</option>
                  <option value="SUCCEEDED">SUCCEEDED</option>
                  <option value="FAILED">FAILED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {taskItems.length > 0 ? (
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                    <input
                      className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={toggleCurrentPageSelected}
                    />
                    <span>选择本页</span>
                    <span className="text-xs text-slate-500">已选 {selectedTaskItems.length} 个</span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={taskBusy || retryableSelectedTaskIds.length === 0}
                      onClick={() => {
                        if (window.confirm(`确认批量重试 ${retryableSelectedTaskIds.length} 个失败任务吗？`)) {
                          retryTasksMutation.mutate(retryableSelectedTaskIds);
                        }
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                      批量重试 {retryableSelectedTaskIds.length}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={taskBusy || cancellableSelectedTaskIds.length === 0}
                      onClick={() => {
                        if (window.confirm(`确认批量取消 ${cancellableSelectedTaskIds.length} 个等待中或运行中任务吗？`)) {
                          cancelTasksMutation.mutate(cancellableSelectedTaskIds);
                        }
                      }}
                    >
                      批量取消 {cancellableSelectedTaskIds.length}
                    </Button>
                  </div>
                </div>
              ) : null}

              {tasksQuery.isLoading ? <div className="text-sm text-slate-500">正在加载任务...</div> : null}
              {!tasksQuery.isLoading && taskItems.length === 0 ? <EmptyState title="暂无任务" description="创建索引重建任务或上传文档后会在这里显示。" /> : null}
              {taskItems.length > 0 ? (
                <div className="space-y-3">
                  {taskItems.map((item) => (
                    <TaskCenterRow
                      key={item.task.id}
                      item={item}
                      selected={selectedTaskIds.has(item.task.id)}
                      busy={taskBusy}
                      onToggleSelect={() => toggleTaskSelected(item.task.id)}
                      onView={() => setSelectedTaskId(item.task.id)}
                      onRetry={() => retryTaskMutation.mutate(item.task.id)}
                      onCancel={() => {
                        if (window.confirm(`确认取消任务 ${shortId(item.task.id)} 吗？`)) {
                          cancelTaskMutation.mutate(item.task.id);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <Pagination page={safeTaskPage} pageSize={TASK_PAGE_SIZE} total={taskTotal} onPageChange={setTaskPage} />
          </Panel>
        </div>
      ) : null}

      {kb.canDelete ? (
        <Panel className="h-fit border-rose-100">
          <PanelHeader title="危险操作" description="删除后无法从前端恢复，请确认不再需要该知识库。" />
          <div className="space-y-4 p-5">
            <ErrorMessage error={deleteMutation.error} />
            <Button
              className="w-full"
              variant="danger"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`确认删除知识库「${kb.name}」吗？该操作无法从前端恢复。`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
              {deleteMutation.isPending ? "删除中..." : "删除知识库"}
            </Button>
          </div>
        </Panel>
      ) : null}
      <TaskDetailDrawer
        open={Boolean(selectedTaskId)}
        task={selectedTaskQuery.data}
        loading={selectedTaskQuery.isLoading}
        error={selectedTaskQuery.error || retryTaskMutation.error || cancelTaskMutation.error}
        busy={retryTaskMutation.isPending || cancelTaskMutation.isPending}
        onClose={() => setSelectedTaskId(null)}
        onRetry={(taskId) => retryTaskMutation.mutate(taskId)}
        onCancel={(taskId) => {
          if (window.confirm(`确认取消任务 ${shortId(taskId)} 吗？`)) {
            cancelTaskMutation.mutate(taskId);
          }
        }}
      />
    </div>
  );
}

function TaskStatsOverview({ stats, loading }: { stats?: TaskStatsResponse; loading: boolean }) {
  const items = [
    { label: "总任务", value: stats?.total ?? 0, tone: "text-slate-900" },
    { label: "运行中", value: stats?.running ?? 0, tone: "text-cyan-700" },
    { label: "失败", value: stats?.failed ?? 0, tone: "text-rose-700" },
    { label: "取消中", value: stats?.cancelRequested ?? 0, tone: "text-amber-700" },
    { label: "文档入库", value: stats?.ingestDocument ?? 0, tone: "text-slate-700" },
    { label: "索引重建", value: stats?.rebuildKnowledgeBaseIndex ?? 0, tone: "text-slate-700" }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">{item.label}</p>
          <p className={cn("mt-1 text-xl font-semibold", item.tone)}>{loading && !stats ? "-" : item.value}</p>
        </div>
      ))}
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:col-span-2 xl:col-span-3">
        <p className="text-xs text-slate-500">平均耗时</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{stats ? formatDurationMs(stats.averageDurationMs) : "-"}</p>
      </div>
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:col-span-2 xl:col-span-3">
        <p className="text-xs text-slate-500">最长耗时</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{stats ? formatDurationMs(stats.maxDurationMs) : "-"}</p>
      </div>
    </div>
  );
}

function TaskDetailDrawer({
  open,
  task,
  loading,
  error,
  busy,
  onClose,
  onRetry,
  onCancel
}: {
  open: boolean;
  task?: TaskResponse;
  loading: boolean;
  error: unknown;
  busy: boolean;
  onClose: () => void;
  onRetry: (taskId: string) => void;
  onCancel: (taskId: string) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const canRetry = task?.status === "FAILED";
  const canCancel = Boolean(task && ["PENDING", "RUNNING"].includes(task.status) && !task.cancelRequested);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="任务详情">
      <button className="absolute inset-0 h-full w-full cursor-default" type="button" aria-label="关闭任务详情" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-950/15 sm:w-[min(640px,calc(100vw-4rem))]">
        <div className="flex min-w-0 items-start justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold text-slate-950">任务详情</h3>
              {task ? <Badge tone={statusTone(task.status)}>{task.status}</Badge> : null}
              {task?.cancelRequested ? <Badge tone="amber">取消中</Badge> : null}
            </div>
            <p className="mt-1 truncate text-sm text-slate-600">{task ? `${task.type} · ${shortId(task.id)}` : "正在加载任务..."}</p>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            type="button"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <ErrorMessage error={error} />
          {loading ? <p className="text-sm text-slate-500">正在加载任务...</p> : null}
          {!loading && !task ? <EmptyState title="任务不存在" description="任务可能已被删除或当前账号没有权限访问。" /> : null}
          {task ? (
            <div className="space-y-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <TaskMeta label="任务 ID" value={task.id} />
                <TaskMeta label="任务类型" value={task.type} />
                <TaskMeta label="文档 ID" value={task.documentId ?? "-"} />
                <TaskMeta label="知识库 ID" value={task.knowledgeBaseId ?? "-"} />
                <TaskMeta label="尝试次数" value={`${task.attempts}/${task.maxAttempts}`} />
                <TaskMeta label="取消请求" value={task.cancelRequested ? "是" : "否"} />
                <TaskMeta label="创建时间" value={formatDateTime(task.createdAt)} />
                <TaskMeta label="锁定时间" value={formatDateTime(task.lockedAt)} />
                <TaskMeta label="开始时间" value={formatDateTime(task.startedAt)} />
                <TaskMeta label="完成时间" value={formatDateTime(task.finishedAt)} />
              </div>
              {task.errorMessage ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">
                  <p className="text-xs font-medium uppercase text-slate-400">错误或状态信息</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{task.errorMessage}</p>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                {canRetry ? (
                  <Button type="button" variant="secondary" disabled={busy} onClick={() => onRetry(task.id)}>
                    <RefreshCw className="h-4 w-4" />
                    重试
                  </Button>
                ) : null}
                {canCancel ? (
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => onCancel(task.id)}>
                    取消任务
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function TaskMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function formatDurationMs(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }
  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }
  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds >= 10 ? 0 : 1)} 秒`;
  }
  const minutes = seconds / 60;
  if (minutes < 60) {
    return `${minutes.toFixed(minutes >= 10 ? 0 : 1)} 分钟`;
  }
  return `${(minutes / 60).toFixed(1)} 小时`;
}

function TaskCenterRow({
  item,
  selected,
  busy,
  onToggleSelect,
  onView,
  onRetry,
  onCancel
}: {
  item: TaskListItem;
  selected: boolean;
  busy: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const task = item.task;
  const title = task.type === "INGEST_DOCUMENT"
    ? item.documentFileName || "文档入库任务"
    : item.knowledgeBaseName || "索引重建任务";
  const canRetry = task.status === "FAILED";
  const canCancel = ["PENDING", "RUNNING"].includes(task.status) && !task.cancelRequested;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <input
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
            type="checkbox"
            checked={selected}
            aria-label={`选择任务 ${shortId(task.id)}`}
            onChange={onToggleSelect}
          />
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-medium text-slate-900">{title}</p>
            <p className="mt-1 break-words text-xs text-slate-500">
              {task.type} · 任务 {shortId(task.id)}
              {task.documentId ? ` · 文档 ${shortId(task.documentId)}` : ""}
              {task.knowledgeBaseId ? ` · 知识库 ${shortId(task.knowledgeBaseId)}` : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Badge tone={statusTone(task.status)}>{task.status}</Badge>
          {task.cancelRequested ? <Badge tone="amber">取消中</Badge> : null}
          <Button type="button" variant="secondary" size="sm" onClick={onView}>
            详情
          </Button>
          {canRetry ? (
            <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onRetry}>
              重试
            </Button>
          ) : null}
          {canCancel ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
              取消
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
        <span>尝试：{task.attempts}/{task.maxAttempts}</span>
        <span>创建：{formatDateTime(task.createdAt)}</span>
        <span>开始：{formatDateTime(task.startedAt)}</span>
        <span>完成：{formatDateTime(task.finishedAt)}</span>
      </div>
      {task.errorMessage ? (
        <div className={cn(
          "mt-3 rounded-lg border px-3 py-2 text-xs leading-5",
          task.status === "FAILED" ? "border-rose-100 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"
        )}>
          {task.errorMessage}
        </div>
      ) : null}
    </div>
  );
}
