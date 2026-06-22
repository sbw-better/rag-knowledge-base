import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  FileText,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Settings,
  Trash2,
  Upload
} from "lucide-react";
import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Panel, PanelHeader, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { cn, formatBytes, formatDateTime, shortId } from "../lib/utils";
import type { Citation, ChatResponse, DocumentResponse, SearchHit, SearchMode, TaskResponse } from "../types";

type Tab = "documents" | "search" | "chat" | "settings";
type RecentUpload = {
  document: DocumentResponse;
  task: TaskResponse;
};
type ChatItem = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [
  { id: "documents", label: "文档", icon: FileText },
  { id: "search", label: "检索", icon: Search },
  { id: "chat", label: "问答", icon: MessageSquare },
  { id: "settings", label: "设置", icon: Settings }
];

function uploadStorageKey(kbId: string) {
  return `ragkb.uploads.${kbId}`;
}

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
  if (status === "COMPLETED" || status === "READY") {
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

  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-8">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-emerald-700">知识库工作台</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">{kbQuery.data?.name ?? "正在加载..."}</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">{kbQuery.data?.description || "未填写描述"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {kbQuery.data ? (
            <>
              <Badge tone="green">TopK {kbQuery.data.topK}</Badge>
              <Badge tone="cyan">Chunk {kbQuery.data.chunkSize}</Badge>
              <Badge>Overlap {kbQuery.data.chunkOverlap}</Badge>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={cn(
                "flex h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium",
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
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
      {activeTab === "documents" ? <DocumentsPanel kbId={kbId} /> : null}
      {activeTab === "search" ? <SearchPanel kbId={kbId} defaultTopK={kbQuery.data?.topK ?? 5} /> : null}
      {activeTab === "chat" ? <ChatPanel kbId={kbId} defaultTopK={kbQuery.data?.topK ?? 5} /> : null}
      {activeTab === "settings" && kbQuery.data ? <SettingsPanel kb={kbQuery.data} /> : null}
    </div>
  );
}

function DocumentsPanel({ kbId }: { kbId: string }) {
  const [uploads, setUploads] = useState<RecentUpload[]>(() => getStoredUploads(kbId));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setUploads(getStoredUploads(kbId));
    setSelectedFile(null);
    setIsDragging(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [kbId]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) {
        throw new Error("请选择要上传的文档");
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  });

  function chooseFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setSelectedFile(file);
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
    <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <Panel className="h-fit">
        <PanelHeader title="上传文档" description="支持后端已接入的 PDF、DOCX、TXT、Markdown、HTML。" />
        <div className="space-y-4 p-5">
          <div
            className={cn(
              "flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition",
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
          <UploadErrorMessage error={uploadMutation.error} />
          <Button className="w-full" disabled={!selectedFile || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? "上传中..." : "上传并入库"}
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="最近文档任务" description="当前后端第一版未提供历史文档列表，这里保留本浏览器最近上传记录。" />
        <div className="p-5">
          {uploads.length === 0 ? (
            <EmptyState title="暂无上传记录" description="上传文档后，任务状态会显示在这里并自动刷新。" />
          ) : (
            <div className="space-y-3">
              {uploads.map((item) => (
                <TaskRow key={item.task.id} item={item} onTaskChange={replaceTask} />
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function TaskRow({ item, onTaskChange }: { item: RecentUpload; onTaskChange: (task: TaskResponse) => void }) {
  const shouldPoll = !["COMPLETED", "FAILED"].includes(item.task.status);
  const taskQuery = useQuery({
    queryKey: ["task", item.task.id],
    queryFn: () => api.getTask(item.task.id),
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 3000 : false
  });

  const task = taskQuery.data ?? item.task;

  useEffect(() => {
    if (taskQuery.data && taskQuery.data.status !== item.task.status) {
      onTaskChange(taskQuery.data);
    }
  }, [item.task.status, onTaskChange, taskQuery.data]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-medium text-slate-900">{item.document.fileName}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatBytes(item.document.sizeBytes)} · 文档 {shortId(item.document.id)} · 任务 {shortId(task.id)}
          </p>
        </div>
        <Badge tone={statusTone(task.status)}>{task.status}</Badge>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
        <span>类型：{task.type}</span>
        <span>尝试：{task.attempts}</span>
        <span>完成：{formatDateTime(task.finishedAt)}</span>
      </div>
      {task.errorMessage ? (
        <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-700">
          <p className="font-medium">{taskErrorTitle(task.errorMessage)}</p>
          <p className="mt-1 text-rose-600">{task.errorMessage}</p>
          <p className="mt-2 text-rose-500">
            可以检查 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、网络代理，或先移除 API Key 使用本地 fallback 验证链路。
          </p>
        </div>
      ) : null}
    </div>
  );
}

function SearchPanel({ kbId, defaultTopK }: { kbId: string; defaultTopK: number }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("HYBRID");
  const [topK, setTopK] = useState(defaultTopK);

  const searchMutation = useMutation({
    mutationFn: () => api.search({ knowledgeBaseId: kbId, query, mode, topK })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    searchMutation.mutate();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[390px_1fr]">
      <Panel className="h-fit">
        <PanelHeader title="检索测试" description="用于验证文档切片和召回效果。" />
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="问题或关键词">
            <Textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入要检索的内容" required />
          </Field>
          <Field label="检索模式">
            <div className="grid grid-cols-3 gap-2">
              {(["VECTOR", "KEYWORD", "HYBRID"] as SearchMode[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  className={cn(
                    "h-9 rounded-lg border text-xs font-medium",
                    mode === item ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"
                  )}
                  onClick={() => setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Field>
          <Field label="TopK">
            <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
          </Field>
          <ErrorMessage error={searchMutation.error} />
          <Button className="w-full" type="submit" disabled={searchMutation.isPending}>
            <Search className="h-4 w-4" />
            {searchMutation.isPending ? "检索中..." : "开始检索"}
          </Button>
        </form>
      </Panel>

      <Panel>
        <PanelHeader title="命中片段" description="展示召回来源、分数和文本内容。" />
        <div className="space-y-3 p-5">
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
    <article className="rounded-lg border border-slate-200 bg-white p-4">
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
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{hit.content}</p>
    </article>
  );
}

function ChatPanel({ kbId, defaultTopK }: { kbId: string; defaultTopK: number }) {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [question, setQuestion] = useState("");
  const [topK, setTopK] = useState(defaultTopK);
  const [messages, setMessages] = useState<ChatItem[]>([]);

  const chatMutation = useMutation({
    mutationFn: () => api.chat({ knowledgeBaseId: kbId, conversationId, question, topK }),
    onSuccess: (data: ChatResponse) => {
      setConversationId(data.conversationId);
      setMessages((current) => [...current, { role: "assistant", content: data.answer, citations: data.citations }]);
      setQuestion("");
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    chatMutation.mutate();
  }

  const citations = useMemo(() => messages.flatMap((item) => item.citations ?? []), [messages]);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel className="min-h-[640px]">
        <PanelHeader
          title="RAG 问答"
          description={conversationId ? `会话 ${shortId(conversationId)}` : "每次回答都会附带引用来源。"}
          actions={
            <Field label="TopK">
              <Input className="w-24" type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
            </Field>
          }
        />
        <div className="flex h-[520px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? <EmptyState title="开始提问" description="问题会先检索当前知识库，再由大模型基于上下文回答。" /> : null}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[min(760px,90%)] rounded-lg px-4 py-3 text-sm leading-6",
                    message.role === "user" ? "bg-emerald-600 text-white" : "border border-slate-200 bg-white text-slate-800"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-700">
                      <Bot className="h-3.5 w-3.5" />
                      Assistant
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.citations?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.citations.map((citation, citationIndex) => (
                        <Badge key={`${citation.chunkId}-${citationIndex}`} tone="cyan">
                          引用 {citationIndex + 1}: {citation.fileName}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {chatMutation.isPending ? <div className="text-sm text-slate-500">正在检索并生成回答...</div> : null}
          </div>
          <form onSubmit={submit} className="border-t border-slate-100 p-4">
            <ErrorMessage error={chatMutation.error} />
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
                disabled={chatMutation.isPending || !question.trim()}
              >
                <Send className="h-4 w-4" />
                发送
              </Button>
            </div>
          </form>
        </div>
      </Panel>

      <Panel className="h-fit">
        <PanelHeader title="引用来源" description="最近回答中命中的文档片段。" />
        <div className="space-y-3 p-5">
          {citations.length === 0 ? <EmptyState title="暂无引用" description="完成一次问答后会显示来源片段。" /> : null}
          {citations.map((citation, index) => (
            <details key={`${citation.chunkId}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                引用 {index + 1} · {citation.fileName}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <div>Chunk #{citation.chunkIndex} · Score {citation.score.toFixed(4)}</div>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{citation.snippet}</p>
              </div>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SettingsPanel({ kb }: { kb: { id: string; name: string; description: string | null; chunkSize: number; chunkOverlap: number; topK: number } }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description ?? "");
  const [chunkSize, setChunkSize] = useState(kb.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(kb.chunkOverlap);
  const [topK, setTopK] = useState(kb.topK);

  const updateMutation = useMutation({
    mutationFn: () => api.updateKnowledgeBase(kb.id, { name, description, chunkSize, chunkOverlap, topK }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kb.id] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteKnowledgeBase(kb.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      navigate("/app/knowledge-bases", { replace: true });
    }
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel>
        <PanelHeader title="知识库设置" description="修改后只影响后续上传和检索参数。" />
        <form
          className="space-y-4 p-5"
          onSubmit={(event) => {
            event.preventDefault();
            updateMutation.mutate();
          }}
        >
          <Field label="名称">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          <Field label="描述">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Chunk Size">
              <Input type="number" min={200} max={4000} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} />
            </Field>
            <Field label="Chunk Overlap">
              <Input type="number" min={0} max={1000} value={chunkOverlap} onChange={(event) => setChunkOverlap(Number(event.target.value))} />
            </Field>
            <Field label="TopK">
              <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
            </Field>
          </div>
          <ErrorMessage error={updateMutation.error} />
          <Button type="submit" disabled={updateMutation.isPending}>
            <RefreshCw className="h-4 w-4" />
            {updateMutation.isPending ? "保存中..." : "保存设置"}
          </Button>
        </form>
      </Panel>

      <Panel className="h-fit border-rose-100">
        <PanelHeader title="危险操作" description="删除后无法从前端恢复。" />
        <div className="space-y-4 p-5">
          <ErrorMessage error={deleteMutation.error} />
          <Button className="w-full" variant="danger" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            <Trash2 className="h-4 w-4" />
            {deleteMutation.isPending ? "删除中..." : "删除知识库"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
