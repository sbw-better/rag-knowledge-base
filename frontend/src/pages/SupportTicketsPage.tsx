import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Modal, PageHeader, Panel } from "../components/ui";
import { api } from "../lib/api";
import type {
  ChatResponse,
  SupportTicketPriority,
  SupportTicketRequest,
  SupportTicketResponse,
  SupportTicketStatus
} from "../types";
import { CreateTicketModal, TicketDetailMain, TicketQueue, TicketSideRail, type TicketQueueStats } from "./support-tickets/components";
import { PAGE_SIZE, statusLabels } from "./support-tickets/constants";

type BatchSupportTicketStatus = Exclude<SupportTicketStatus, "CLOSED">;

type BatchAction = { type: "assign-to-me" } | { type: "status"; status: SupportTicketStatus } | { type: "generate-replies" };

type BatchResultItem = {
  id: string;
  ticketNo: string;
  issueSummary: string;
  success: boolean;
  message: string;
  updatedTicket?: SupportTicketResponse;
  chat?: ChatResponse;
};

type BatchResult = {
  title: string;
  items: BatchResultItem[];
};

const batchStatusOptions: BatchSupportTicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED"];

function isBatchSupportTicketStatus(status: SupportTicketStatus): status is BatchSupportTicketStatus {
  return status !== "CLOSED";
}

export default function SupportTicketsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const ticketId = params.id;
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus | "">("");
  const [priority, setPriority] = useState<SupportTicketPriority | "">("");
  const [mineOnly, setMineOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [draftReply, setDraftReply] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [lastChat, setLastChat] = useState<ChatResponse | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me
  });

  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const knowledgeBases = Array.isArray(knowledgeBasesQuery.data) ? knowledgeBasesQuery.data : [];

  const listQuery = useQuery({
    queryKey: ["support-tickets", page, PAGE_SIZE, keyword, status, priority, mineOnly, overdueOnly],
    queryFn: () => api.listSupportTicketsPage({ page, pageSize: PAGE_SIZE, keyword, status, priority, mine: mineOnly, overdue: overdueOnly })
  });
  const tickets = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const safePage = listQuery.data?.page ?? page;

  const summaryQueries = useQueries({
    queries: [
      {
        queryKey: ["support-ticket-summary", "OPEN", keyword, priority, mineOnly, overdueOnly],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, keyword, status: "OPEN", priority, mine: mineOnly, overdue: overdueOnly })
      },
      {
        queryKey: ["support-ticket-summary", "IN_PROGRESS", keyword, priority, mineOnly, overdueOnly],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, keyword, status: "IN_PROGRESS", priority, mine: mineOnly, overdue: overdueOnly })
      },
      {
        queryKey: ["support-ticket-summary", "WAITING_CUSTOMER", keyword, priority, mineOnly, overdueOnly],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, keyword, status: "WAITING_CUSTOMER", priority, mine: mineOnly, overdue: overdueOnly })
      },
      {
        queryKey: ["support-ticket-summary", "OVERDUE", keyword, status, priority, mineOnly],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, keyword, status, priority, mine: mineOnly, overdue: true })
      }
    ]
  });

  const queueStats: TicketQueueStats = {
    open: summaryQueries[0].data?.total ?? 0,
    inProgress: summaryQueries[1].data?.total ?? 0,
    waitingCustomer: summaryQueries[2].data?.total ?? 0,
    overdue: summaryQueries[3].data?.total ?? 0,
    loading: summaryQueries.some((query) => query.isLoading)
  };

  const detailQuery = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => api.getSupportTicket(ticketId || ""),
    enabled: Boolean(ticketId)
  });
  const ticket = detailQuery.data ?? null;

  const eventsQuery = useQuery({
    queryKey: ["support-ticket-events", ticketId],
    queryFn: () => api.listSupportTicketEvents(ticketId || ""),
    enabled: Boolean(ticketId)
  });

  const feedbackLinksQuery = useQuery({
    queryKey: ["support-ticket-feedback-links", ticketId],
    queryFn: () =>
      api.getBusinessFeedbackLinks({
        knowledgeBaseId: ticket?.knowledgeBaseId || "",
        businessModule: "SUPPORT_TICKET",
        businessEntityId: ticketId || "",
        limit: 8
      }),
    enabled: Boolean(ticketId && ticket?.knowledgeBaseId)
  });

  useEffect(() => {
    setPage(1);
  }, [keyword, status, priority, mineOnly, overdueOnly]);

  useEffect(() => {
    const visibleIds = new Set(tickets.map((item) => item.id));
    setSelectedTicketIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [tickets]);

  useEffect(() => {
    setDraftReply(ticket?.latestAiReply ?? "");
    setLastChat(null);
    setInstruction("");
    setInternalNote("");
    setCustomerMessage("");
  }, [ticket?.id, ticket?.latestAiReply]);

  const createMutation = useMutation({
    mutationFn: api.createSupportTicket,
    onSuccess: (created) => {
      setCreateOpen(false);
      refreshTickets(created.id);
      navigate(`/app/support-tickets/${created.id}`);
    }
  });

  const demoMutation = useMutation({
    mutationFn: () => api.createDemoSupportTickets(knowledgeBases[0]?.id ?? ""),
    onSuccess: (created) => {
      refreshTickets(created[0]?.id);
      if (created[0]) {
        navigate(`/app/support-tickets/${created[0].id}`);
      }
    }
  });

  const replyMutation = useMutation({
    mutationFn: (overrideInstruction?: string) => api.generateSupportTicketReply(ticketId || "", overrideInstruction ?? instruction.trim()),
    onSuccess: (result) => {
      setDraftReply(result.ticket.latestAiReply ?? result.chat.answer);
      setLastChat(result.chat);
      refreshTickets(result.ticket.id);
      queryClient.invalidateQueries({ queryKey: ["support-ticket-feedback-links", result.ticket.id] });
      queryClient.setQueryData(["support-ticket", result.ticket.id], result.ticket);
    }
  });

  const saveReplyMutation = useMutation({
    mutationFn: () => api.updateSupportTicket(ticketId || "", toTicketRequest(ticket, draftReply)),
    onSuccess: (updated) => {
      refreshTickets(updated.id);
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  const assignMutation = useMutation({
    mutationFn: (assigneeId: string | null) => api.assignSupportTicket(ticketId || "", assigneeId, assigneeId ? "接手处理" : "取消负责人"),
    onSuccess: (updated) => {
      refreshTickets(updated.id);
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  const statusMutation = useMutation({
    mutationFn: (nextStatus: SupportTicketStatus) => api.changeSupportTicketStatus(ticketId || "", nextStatus, `状态调整为${statusLabels[nextStatus]}`),
    onSuccess: (updated) => {
      refreshTickets(updated.id);
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  const closeMutation = useMutation({
    mutationFn: () => api.closeSupportTicket(ticketId || "", "关闭工单"),
    onSuccess: (updated) => {
      refreshTickets(updated.id);
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  const reopenMutation = useMutation({
    mutationFn: () => api.reopenSupportTicket(ticketId || "", "重开工单"),
    onSuccess: (updated) => {
      refreshTickets(updated.id);
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  const noteMutation = useMutation({
    mutationFn: () => api.addSupportTicketNote(ticketId || "", internalNote.trim()),
    onSuccess: () => {
      setInternalNote("");
      refreshTickets(ticketId);
    }
  });

  const customerMessageMutation = useMutation({
    mutationFn: () => api.addSupportTicketCustomerMessage(ticketId || "", customerMessage.trim()),
    onSuccess: () => {
      setCustomerMessage("");
      refreshTickets(ticketId);
    }
  });

  const sendReplyMutation = useMutation({
    mutationFn: () => api.sendSupportTicketReply(ticketId || "", draftReply.trim()),
    onSuccess: (updated) => {
      refreshTickets(updated.id);
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  const resolveIssueMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => api.resolveKnowledgeIssue(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-feedback-links", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-events", ticketId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-issues"] });
      queryClient.invalidateQueries({ queryKey: ["support-ticket-stats"] });
    }
  });

  const batchMutation = useMutation({
    mutationFn: async (action: BatchAction): Promise<BatchResult> => {
      const actionTickets = [...selectedTickets];
      const title = batchActionTitle(action);
      if (actionTickets.length === 0) {
        return { title, items: [] };
      }
      const items = await Promise.all(actionTickets.map((item) => runBatchTicketAction(item, action, currentUserId)));
      return { title, items };
    },
    onSuccess: (result) => {
      const activeTicketId = selectedTicketIds.includes(ticketId || "") ? ticketId : undefined;
      const failedIds = result.items.filter((item) => !item.success).map((item) => item.id);
      result.items.forEach((item) => {
        if (item.updatedTicket) {
          queryClient.setQueryData(["support-ticket", item.updatedTicket.id], item.updatedTicket);
          if (item.updatedTicket.id === ticketId && item.updatedTicket.latestAiReply) {
            setDraftReply(item.updatedTicket.latestAiReply);
          }
        }
        if (item.chat && item.id === ticketId) {
          setLastChat(item.chat);
        }
      });
      setSelectedTicketIds(failedIds);
      setBatchResult(result);
      refreshTickets(activeTicketId);
    }
  });

  function refreshTickets(activeTicketId?: string) {
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket-summary"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket-stats"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket"] });
    if (activeTicketId) {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-events", activeTicketId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-events"] });
    }
  }

  const currentUserId = meQuery.data?.id ?? null;
  const selectedTickets = tickets.filter((item) => selectedTicketIds.includes(item.id));
  const batchAllowedStatuses =
    selectedTickets.length === 0
      ? []
      : selectedTickets
          .map((item) => item.allowedStatuses.filter(isBatchSupportTicketStatus))
          .reduce<BatchSupportTicketStatus[]>((allowed, item) => allowed.filter((statusItem) => item.includes(statusItem)), batchStatusOptions);
  const canBatchAssignToMe = Boolean(currentUserId) && selectedTickets.length > 0 && selectedTickets.every((item) => item.canWork && item.status !== "CLOSED");
  const canBatchGenerateReply = selectedTickets.length > 0 && selectedTickets.every((item) => item.canWork && item.status !== "CLOSED");
  const actionError =
    detailQuery.error ||
    replyMutation.error ||
    saveReplyMutation.error ||
    assignMutation.error ||
    statusMutation.error ||
    closeMutation.error ||
    reopenMutation.error ||
    noteMutation.error ||
    customerMessageMutation.error ||
    sendReplyMutation.error ||
    resolveIssueMutation.error ||
    batchMutation.error;
  const visibleTicketIds = tickets.map((item) => item.id);

  return (
    <div className="mx-auto w-full max-w-[112rem] min-w-0 p-4 lg:p-6">
      <PageHeader
        eyebrow="客服工作台"
        title="售后工单"
        description="把待办队列、客户问题、处理动作和回复草稿分区处理。"
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => listQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button variant="secondary" size="sm" disabled={demoMutation.isPending || knowledgeBases.length === 0} onClick={() => demoMutation.mutate()}>
              <Sparkles className="h-4 w-4" />
              {demoMutation.isPending ? "生成中" : "示例工单"}
            </Button>
            <Button size="sm" disabled={knowledgeBases.length === 0} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </>
        }
      />

      <ErrorMessage error={knowledgeBasesQuery.error || demoMutation.error} />
      {knowledgeBases.length === 0 && !knowledgeBasesQuery.isLoading ? (
        <Panel className="mb-4 p-5">
          <EmptyState title="还没有可用知识库" description="先创建并授权一个售后知识库，再把工单绑定到知识库生成回复。" />
        </Panel>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[22rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)_24rem]">
        <TicketQueue
          tickets={tickets}
          activeTicketId={ticketId}
          total={total}
          page={safePage}
          pageSize={PAGE_SIZE}
          loading={listQuery.isLoading}
          error={listQuery.error}
          keyword={keyword}
          status={status}
          priority={priority}
          mineOnly={mineOnly}
          overdueOnly={overdueOnly}
          stats={queueStats}
          selectedIds={selectedTicketIds}
          batchBusy={batchMutation.isPending}
          canAssignToMe={canBatchAssignToMe}
          canGenerateReply={canBatchGenerateReply}
          batchAllowedStatuses={batchAllowedStatuses}
          onKeywordChange={setKeyword}
          onStatusChange={setStatus}
          onPriorityChange={setPriority}
          onMineOnlyChange={setMineOnly}
          onOverdueOnlyChange={setOverdueOnly}
          onToggleSelected={(id, checked) =>
            setSelectedTicketIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)))
          }
          onTogglePageSelected={(checked) => setSelectedTicketIds(checked ? visibleTicketIds : [])}
          onClearSelected={() => setSelectedTicketIds([])}
          onBatchAssignToMe={() => batchMutation.mutate({ type: "assign-to-me" })}
          onBatchGenerateReplies={() => batchMutation.mutate({ type: "generate-replies" })}
          onBatchStatusChange={(nextStatus) => batchMutation.mutate({ type: "status", status: nextStatus })}
          onOpen={(id) => navigate(`/app/support-tickets/${id}`)}
          onPageChange={setPage}
        />

        <Panel className="min-h-[34rem] overflow-hidden">
          {!ticketId ? (
            <div className="p-5">
              <EmptyState title="选择一个工单开始处理" description="详情、处理动作和回复草稿会按区域展开。" />
            </div>
          ) : null}
          {detailQuery.isLoading ? <p className="p-5 text-sm text-slate-500">正在加载工单详情...</p> : null}
          <ErrorMessage error={actionError} />
          {ticket ? (
            <TicketDetailMain
              ticket={ticket}
              draftReply={draftReply}
              instruction={instruction}
              events={eventsQuery.data ?? []}
              loadingEvents={eventsQuery.isLoading}
              customerMessage={customerMessage}
              feedbackLinks={feedbackLinksQuery.data}
              loadingFeedbackLinks={feedbackLinksQuery.isLoading}
              chat={lastChat}
              generating={replyMutation.isPending}
              saving={saveReplyMutation.isPending}
              sendingReply={sendReplyMutation.isPending}
              addingCustomerMessage={customerMessageMutation.isPending}
              resolvingIssue={resolveIssueMutation.isPending}
              onInstructionChange={setInstruction}
              onDraftReplyChange={setDraftReply}
              onCustomerMessageChange={setCustomerMessage}
              onGenerate={() => replyMutation.mutate(undefined)}
              onSave={() => saveReplyMutation.mutate()}
              onSendReply={() => sendReplyMutation.mutate()}
              onAddCustomerMessage={() => customerMessageMutation.mutate()}
              onResolveIssue={(issueId) => {
                const note = window.prompt("处理说明，比如已补充哪份资料、调整了哪个知识点。");
                if (note !== null) {
                  resolveIssueMutation.mutate({ id: issueId, note: note.trim() || undefined });
                }
              }}
              onRetestIssue={(question) => {
                const nextInstruction = `请基于已补充或已调整的知识内容，复检这个知识缺口并重新生成客服回复：${question}`;
                setInstruction(nextInstruction);
                replyMutation.mutate(nextInstruction);
              }}
            />
          ) : null}
        </Panel>

        {ticket ? (
          <TicketSideRail
            ticket={ticket}
            currentUserId={currentUserId}
            internalNote={internalNote}
            events={eventsQuery.data ?? []}
            loadingEvents={eventsQuery.isLoading}
            busy={assignMutation.isPending || statusMutation.isPending || closeMutation.isPending || reopenMutation.isPending || noteMutation.isPending}
            onAssignToMe={() => currentUserId && assignMutation.mutate(currentUserId)}
            onUnassign={() => assignMutation.mutate(null)}
            onStatusChange={(nextStatus) => statusMutation.mutate(nextStatus)}
            onClose={() => closeMutation.mutate()}
            onReopen={() => reopenMutation.mutate()}
            onNoteChange={setInternalNote}
            onAddNote={() => noteMutation.mutate()}
          />
        ) : null}
      </div>

      <CreateTicketModal
        open={createOpen}
        knowledgeBases={knowledgeBases}
        pending={createMutation.isPending}
        error={createMutation.error}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
      <BatchResultModal result={batchResult} onClose={() => setBatchResult(null)} />
    </div>
  );
}

async function runBatchTicketAction(ticket: SupportTicketResponse, action: BatchAction, currentUserId: string | null): Promise<BatchResultItem> {
  try {
    if (action.type === "assign-to-me") {
      if (!currentUserId) {
        throw new Error("当前登录用户信息还在加载");
      }
      if (!ticket.canWork || ticket.status === "CLOSED") {
        throw new Error("当前工单不可接手");
      }
      const updatedTicket = await api.assignSupportTicket(ticket.id, currentUserId, "批量接手处理");
      return toBatchResultItem(ticket, true, "已接手", updatedTicket);
    }
    if (action.type === "status") {
      if (!ticket.allowedStatuses.includes(action.status)) {
        throw new Error(`不可流转到${statusLabels[action.status]}`);
      }
      const updatedTicket = await api.changeSupportTicketStatus(ticket.id, action.status, `批量调整为${statusLabels[action.status]}`);
      return toBatchResultItem(ticket, true, `已调整为${statusLabels[action.status]}`, updatedTicket);
    }
    if (!ticket.canWork || ticket.status === "CLOSED") {
      throw new Error("当前工单不可生成回复");
    }
    const result = await api.generateSupportTicketReply(ticket.id, "批量生成客服回复，请保持语气简洁、明确下一步处理方式。");
    return {
      ...toBatchResultItem(ticket, true, "已生成回复草稿", result.ticket),
      chat: result.chat
    };
  } catch (error) {
    return toBatchResultItem(ticket, false, readableError(error));
  }
}

function toBatchResultItem(ticket: SupportTicketResponse, success: boolean, message: string, updatedTicket?: SupportTicketResponse): BatchResultItem {
  return {
    id: ticket.id,
    ticketNo: ticket.ticketNo,
    issueSummary: ticket.issueSummary,
    success,
    message,
    updatedTicket
  };
}

function batchActionTitle(action: BatchAction) {
  if (action.type === "assign-to-me") {
    return "批量接手结果";
  }
  if (action.type === "generate-replies") {
    return "批量生成回复结果";
  }
  return `批量状态流转结果：${statusLabels[action.status]}`;
}

function readableError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error || "操作失败");
}

function BatchResultModal({ result, onClose }: { result: BatchResult | null; onClose: () => void }) {
  if (!result) {
    return null;
  }
  const successCount = result.items.filter((item) => item.success).length;
  const failedCount = result.items.length - successCount;
  return (
    <Modal open={Boolean(result)} title={result.title} description="失败项会保留在队列选择中，方便继续处理或重试。" onClose={onClose}>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryTile label="总数" value={result.items.length} />
          <SummaryTile label="成功" value={successCount} tone="green" />
          <SummaryTile label="失败" value={failedCount} tone={failedCount > 0 ? "rose" : "slate"} />
        </div>
        {result.items.length === 0 ? (
          <EmptyState title="没有可处理的工单" description="请先在左侧队列中勾选需要批量处理的工单。" />
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
            <div className="divide-y divide-slate-100">
              {result.items.map((item) => (
                <div key={item.id} className="flex min-w-0 items-start gap-3 p-3">
                  <span className="mt-0.5 shrink-0">
                    {item.success ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="truncate text-sm font-medium text-slate-900">{item.ticketNo}</p>
                      <Badge tone={item.success ? "green" : "rose"}>{item.success ? "成功" : "失败"}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{item.issueSummary}</p>
                    <p className={`mt-1 text-xs ${item.success ? "text-emerald-700" : "text-rose-700"}`}>{item.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            知道了
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function SummaryTile({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "green" | "rose" }) {
  const toneClass = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-xs opacity-75">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function toTicketRequest(ticket: SupportTicketResponse | null, latestAiReply: string): SupportTicketRequest {
  if (!ticket) {
    throw new Error("请先选择工单");
  }
  return {
    knowledgeBaseId: ticket.knowledgeBaseId,
    assigneeId: ticket.assigneeId,
    ticketNo: ticket.ticketNo,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    channel: ticket.channel,
    customerName: ticket.customerName,
    customerTier: ticket.customerTier ?? undefined,
    customerContact: ticket.customerContact ?? undefined,
    orderNo: ticket.orderNo ?? undefined,
    orderStatus: ticket.orderStatus ?? undefined,
    productName: ticket.productName ?? undefined,
    productSku: ticket.productSku ?? undefined,
    purchasedAt: ticket.purchasedAt,
    dueAt: ticket.dueAt,
    issueSummary: ticket.issueSummary,
    customerQuestion: ticket.customerQuestion,
    latestAiReply
  };
}
