import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, EmptyState, ErrorMessage, PageHeader, Panel } from "../components/ui";
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
  const [lastChat, setLastChat] = useState<ChatResponse | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

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
    mutationFn: () => api.generateSupportTicketReply(ticketId || "", instruction.trim()),
    onSuccess: (result) => {
      setDraftReply(result.ticket.latestAiReply ?? result.chat.answer);
      setLastChat(result.chat);
      refreshTickets(result.ticket.id);
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

  const noteMutation = useMutation({
    mutationFn: () => api.addSupportTicketNote(ticketId || "", internalNote.trim()),
    onSuccess: () => {
      setInternalNote("");
      refreshTickets(ticketId);
    }
  });

  const batchMutation = useMutation({
    mutationFn: async (action: { type: "assign-to-me" } | { type: "status"; status: SupportTicketStatus }) => {
      if (selectedTicketIds.length === 0) {
        return [];
      }
      if (action.type === "assign-to-me") {
        if (!currentUserId) {
          throw new Error("当前登录用户信息还在加载，请稍后再试。");
        }
        return Promise.all(selectedTicketIds.map((id) => api.assignSupportTicket(id, currentUserId, "批量接手处理")));
      }
      return Promise.all(selectedTicketIds.map((id) => api.changeSupportTicketStatus(id, action.status, `批量调整为${statusLabels[action.status]}`)));
    },
    onSuccess: () => {
      const activeTicketId = selectedTicketIds.includes(ticketId || "") ? ticketId : undefined;
      setSelectedTicketIds([]);
      refreshTickets(activeTicketId);
    }
  });

  function refreshTickets(activeTicketId?: string) {
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket-summary"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket"] });
    if (activeTicketId) {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-events", activeTicketId] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["support-ticket-events"] });
    }
  }

  const currentUserId = meQuery.data?.id ?? null;
  const actionError =
    detailQuery.error || replyMutation.error || saveReplyMutation.error || assignMutation.error || statusMutation.error || noteMutation.error || batchMutation.error;
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
          canAssignToMe={Boolean(currentUserId)}
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
              chat={lastChat}
              generating={replyMutation.isPending}
              saving={saveReplyMutation.isPending}
              onInstructionChange={setInstruction}
              onDraftReplyChange={setDraftReply}
              onGenerate={() => replyMutation.mutate()}
              onSave={() => saveReplyMutation.mutate()}
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
            busy={assignMutation.isPending || statusMutation.isPending || noteMutation.isPending}
            onAssignToMe={() => currentUserId && assignMutation.mutate(currentUserId)}
            onUnassign={() => assignMutation.mutate(null)}
            onStatusChange={(nextStatus) => statusMutation.mutate(nextStatus)}
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
