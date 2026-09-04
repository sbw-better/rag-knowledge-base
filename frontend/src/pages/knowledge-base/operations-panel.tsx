import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Hammer, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Input, Pagination, Panel, PanelHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { cn, formatDateTime, shortId } from "../../lib/utils";
import type { KnowledgeIssueResponse, TaskListItem, TaskResponse, TaskStatsResponse } from "../../types";
import { statusTone } from "./shared";

const TASK_PAGE_SIZE = 8;
const ISSUE_PAGE_SIZE = 6;

export function OperationsPanel({ kb }: { kb: { id: string; name: string; canManageOperations: boolean; canDelete: boolean } }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [taskPage, setTaskPage] = useState(1);
  const [taskKeyword, setTaskKeyword] = useState("");
  const [taskType, setTaskType] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [issuePage, setIssuePage] = useState(1);
  const [issueKeyword, setIssueKeyword] = useState("");
  const [issueStatus, setIssueStatus] = useState<"" | "OPEN" | "RESOLVED">("OPEN");

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
  const issuesQuery = useQuery({
    queryKey: ["knowledge-issues", kb.id, issuePage, ISSUE_PAGE_SIZE, issueKeyword, issueStatus],
    queryFn: () => api.listKnowledgeIssuesPage({
      knowledgeBaseId: kb.id,
      page: issuePage,
      pageSize: ISSUE_PAGE_SIZE,
      keyword: issueKeyword,
      status: issueStatus || undefined
    }),
    enabled: kb.canManageOperations
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
  const resolveIssueMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.resolveKnowledgeIssue(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-issues", kb.id] });
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
  const issueItems = issuesQuery.data?.items ?? [];
  const issueTotal = issuesQuery.data?.total ?? 0;
  const issueTotalPages = issuesQuery.data?.totalPages ?? 1;
  const safeIssuePage = issuesQuery.data?.page ?? issuePage;
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
    setIssuePage(1);
  }, [issueKeyword, issueStatus]);

  useEffect(() => {
    if (taskPage > taskTotalPages) {
      setTaskPage(taskTotalPages);
    }
  }, [taskPage, taskTotalPages]);

  useEffect(() => {
    if (issuePage > issueTotalPages) {
      setIssuePage(issueTotalPages);
    }
  }, [issuePage, issueTotalPages]);

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

          <Panel className="min-w-0">
            <PanelHeader
              title="知识缺口"
              description="汇总未命中问题和用户反馈，便于补充资料或调整知识内容。"
              actions={<Badge tone={issueTotal > 0 ? "amber" : "slate"}>{issueTotal} 条</Badge>}
            />
            <div className="space-y-4 p-5">
              <ErrorMessage error={issuesQuery.error || resolveIssueMutation.error} />
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={issueKeyword} onChange={(event) => setIssueKeyword(event.target.value)} placeholder="搜索问题、原因或业务编号" />
                </div>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  value={issueStatus}
                  onChange={(event) => setIssueStatus(event.target.value as "" | "OPEN" | "RESOLVED")}
                >
                  <option value="">全部状态</option>
                  <option value="OPEN">待处理</option>
                  <option value="RESOLVED">已处理</option>
                </select>
              </div>
              {issuesQuery.isLoading ? <div className="text-sm text-slate-500">正在加载知识缺口...</div> : null}
              {!issuesQuery.isLoading && issueItems.length === 0 ? <EmptyState title="暂无知识缺口" description="未命中问题或需补充反馈会在这里显示。" /> : null}
              {issueItems.length > 0 ? (
                <div className="space-y-3">
                  {issueItems.map((issue) => (
                    <KnowledgeIssueRow
                      key={issue.id}
                      issue={issue}
                      busy={resolveIssueMutation.isPending}
                      onResolve={() => {
                        const note = window.prompt("处理说明，比如已补充哪份资料、调整了哪个知识点。");
                        if (note !== null) {
                          resolveIssueMutation.mutate({ id: issue.id, note: note.trim() || undefined });
                        }
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </div>
            <Pagination page={safeIssuePage} pageSize={ISSUE_PAGE_SIZE} total={issueTotal} onPageChange={setIssuePage} />
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

function KnowledgeIssueRow({ issue, busy, onResolve }: { issue: KnowledgeIssueResponse; busy: boolean; onResolve: () => void }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={issue.status === "OPEN" ? "amber" : "green"}>{issueStatusLabel(issue.status)}</Badge>
            <Badge tone={issue.source === "NEGATIVE_FEEDBACK" ? "rose" : "slate"}>{issueSourceLabel(issue.source)}</Badge>
            <span className="text-xs text-slate-400">{formatDateTime(issue.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-900">{issue.question}</p>
        </div>
        {issue.status === "OPEN" ? (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onResolve}>
            <Check className="h-4 w-4" />
            已处理
          </Button>
        ) : null}
      </div>
      {issue.comment ? <p className="mb-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-700">{issue.comment}</p> : null}
      {issue.answerSummary ? (
        <p className="line-clamp-2 whitespace-pre-wrap break-words rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
          {issue.answerSummary}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>缺口 {shortId(issue.id)}</span>
        {issue.businessModule ? <span>{issue.businessModule}</span> : null}
        {issue.businessEntityId ? <span>{issue.businessEntityId}</span> : null}
        {issue.resolutionNote ? <span className="text-emerald-600">{issue.resolutionNote}</span> : null}
      </div>
    </article>
  );
}

function issueSourceLabel(source: KnowledgeIssueResponse["source"]) {
  return source === "NEGATIVE_FEEDBACK" ? "反馈触发" : "未命中";
}

function issueStatusLabel(status: KnowledgeIssueResponse["status"]) {
  return status === "RESOLVED" ? "已处理" : "待处理";
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
