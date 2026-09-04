import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Upload, X } from "lucide-react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState, ErrorMessage, Input, Pagination, Panel, PanelHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { cn, formatBytes, formatDateTime, shortId } from "../../lib/utils";
import type { DocumentChunkResponse, DocumentItem, DocumentResponse, TaskResponse } from "../../types";
import { errorText, statusTone } from "./shared";

type RecentUpload = {
  document: DocumentResponse;
  task: TaskResponse;
};
const DOCUMENT_PAGE_SIZE = 8;

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx", ".txt", ".md", ".markdown", ".html", ".htm"];

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

export function DocumentsPanel({ kbId }: { kbId: string }) {
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

