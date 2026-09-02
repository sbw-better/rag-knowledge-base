import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CheckCircle2, ClipboardList, MessageSquareText, Plus, RefreshCw, Search, Sparkles } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Modal, PageHeader, Pagination, Panel, PanelHeader, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { cn, formatDateTime, shortId } from "../lib/utils";
import type {
  ChatResponse,
  KnowledgeBaseResponse,
  SupportTicketPriority,
  SupportTicketRequest,
  SupportTicketResponse,
  SupportTicketStatus
} from "../types";

const PAGE_SIZE = 8;

const statusLabels: Record<SupportTicketStatus, string> = {
  OPEN: "待处理",
  IN_PROGRESS: "处理中",
  WAITING_CUSTOMER: "待客户",
  RESOLVED: "已解决",
  CLOSED: "已关闭"
};

const priorityLabels: Record<SupportTicketPriority, string> = {
  LOW: "低",
  NORMAL: "普通",
  HIGH: "高",
  URGENT: "紧急"
};

const statusOptions: Array<SupportTicketStatus | ""> = ["", "OPEN", "IN_PROGRESS", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"];
const priorityOptions: Array<SupportTicketPriority | ""> = ["", "URGENT", "HIGH", "NORMAL", "LOW"];

export default function SupportTicketsPage() {
  const navigate = useNavigate();
  const params = useParams();
  const queryClient = useQueryClient();
  const ticketId = params.id;
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus | "">("");
  const [priority, setPriority] = useState<SupportTicketPriority | "">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [draftReply, setDraftReply] = useState("");
  const [lastChat, setLastChat] = useState<ChatResponse | null>(null);

  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const knowledgeBases = Array.isArray(knowledgeBasesQuery.data) ? knowledgeBasesQuery.data : [];

  const listQuery = useQuery({
    queryKey: ["support-tickets", page, PAGE_SIZE, keyword, status, priority],
    queryFn: () => api.listSupportTicketsPage({ page, pageSize: PAGE_SIZE, keyword, status, priority })
  });
  const pageData = listQuery.data;
  const tickets = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const safePage = pageData?.page ?? page;

  const detailQuery = useQuery({
    queryKey: ["support-ticket", ticketId],
    queryFn: () => api.getSupportTicket(ticketId || ""),
    enabled: Boolean(ticketId)
  });
  const ticket = detailQuery.data ?? null;

  useEffect(() => {
    setPage(1);
  }, [keyword, status, priority]);

  useEffect(() => {
    setDraftReply(ticket?.latestAiReply ?? "");
    setLastChat(null);
    setInstruction("");
  }, [ticket?.id, ticket?.latestAiReply]);

  const createMutation = useMutation({
    mutationFn: api.createSupportTicket,
    onSuccess: (created) => {
      setCreateOpen(false);
      refreshTickets();
      navigate(`/app/support-tickets/${created.id}`);
    }
  });

  const demoMutation = useMutation({
    mutationFn: () => api.createDemoSupportTickets(knowledgeBases[0]?.id ?? ""),
    onSuccess: (created) => {
      refreshTickets();
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
      refreshTickets();
      queryClient.setQueryData(["support-ticket", result.ticket.id], result.ticket);
    }
  });

  const saveReplyMutation = useMutation({
    mutationFn: () => api.updateSupportTicket(ticketId || "", toTicketRequest(ticket, draftReply)),
    onSuccess: (updated) => {
      refreshTickets();
      queryClient.setQueryData(["support-ticket", updated.id], updated);
    }
  });

  function refreshTickets() {
    queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["support-ticket"] });
  }

  const selectedKnowledgeBase = useMemo(() => knowledgeBases.find((kb) => kb.id === ticket?.knowledgeBaseId), [knowledgeBases, ticket?.knowledgeBaseId]);

  return (
    <div className="mx-auto max-w-7xl min-w-0 max-w-full p-4 lg:p-8">
      <PageHeader
        eyebrow="售后场景"
        title="售后工单知识助手"
        description="把客户问题、订单商品信息和知识库资料放到同一个处理台里，生成可编辑客服回复并沉淀知识缺口。"
        actions={
          <>
            <Button variant="secondary" onClick={() => listQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button variant="secondary" disabled={demoMutation.isPending || knowledgeBases.length === 0} onClick={() => demoMutation.mutate()}>
              <Sparkles className="h-4 w-4" />
              {demoMutation.isPending ? "生成中..." : "生成示例"}
            </Button>
            <Button disabled={knowledgeBases.length === 0} onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              新建工单
            </Button>
          </>
        }
      />

      <ErrorMessage error={knowledgeBasesQuery.error || demoMutation.error} />
      {knowledgeBases.length === 0 && !knowledgeBasesQuery.isLoading ? (
        <Panel className="mb-5 p-5">
          <EmptyState title="需要先准备知识库" description="创建并授权一个售后知识库后，就可以把工单绑定到知识库并生成客服回复。" />
        </Panel>
      ) : null}

      <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/5 lg:grid-cols-[1fr_11rem_11rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索工单号、客户、订单、商品或问题" />
        </div>
        <Select value={status} onChange={(value) => setStatus(value as SupportTicketStatus | "")}>
          {statusOptions.map((item) => (
            <option key={item || "ALL"} value={item}>
              {item ? statusLabels[item] : "全部状态"}
            </option>
          ))}
        </Select>
        <Select value={priority} onChange={(value) => setPriority(value as SupportTicketPriority | "")}>
          {priorityOptions.map((item) => (
            <option key={item || "ALL"} value={item}>
              {item ? `${priorityLabels[item]}优先级` : "全部优先级"}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[26rem_1fr]">
        <Panel className="overflow-hidden">
          <PanelHeader title="工单队列" description={`当前筛选 ${total} 条`} />
          <div className="divide-y divide-slate-100">
            {listQuery.isLoading ? <p className="p-4 text-sm text-slate-500">正在加载工单...</p> : null}
            <ErrorMessage error={listQuery.error} />
            {!listQuery.isLoading && total === 0 ? (
              <div className="p-4">
                <EmptyState title="暂无工单" description="可以新建工单，或生成几条模拟售后工单用于演示。" />
              </div>
            ) : null}
            {tickets.map((item) => (
              <button
                key={item.id}
                className={cn(
                  "block w-full p-4 text-left transition hover:bg-slate-50",
                  item.id === ticketId && "bg-emerald-50/70 hover:bg-emerald-50"
                )}
                onClick={() => navigate(`/app/support-tickets/${item.id}`)}
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">{item.issueSummary}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.ticketNo} · {item.customerName}
                    </p>
                  </div>
                  <PriorityBadge value={item.priority} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{item.customerQuestion}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge value={item.status} />
                  <Badge tone="cyan">{item.category}</Badge>
                  {item.latestAiReply ? <Badge tone="green">已有 AI 回复</Badge> : null}
                </div>
              </button>
            ))}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </Panel>

        <Panel className="min-h-[34rem] overflow-hidden">
          {!ticketId ? (
            <div className="p-5">
              <EmptyState title="选择一个售后工单" description="进入详情后，可以查看业务上下文、生成客服回复并查看引用来源。" />
            </div>
          ) : null}
          {detailQuery.isLoading ? <p className="p-5 text-sm text-slate-500">正在加载工单详情...</p> : null}
          <ErrorMessage error={detailQuery.error || replyMutation.error || saveReplyMutation.error} />
          {ticket ? (
            <>
              <PanelHeader
                title={ticket.ticketNo}
                description={`${ticket.customerName} · ${ticket.category} · ${ticket.knowledgeBaseName}`}
                actions={
                  <>
                    <StatusBadge value={ticket.status} />
                    <PriorityBadge value={ticket.priority} />
                  </>
                }
              />
              <div className="grid gap-5 p-5 2xl:grid-cols-[1fr_22rem]">
                <section className="min-w-0 space-y-5">
                  <div>
                    <h2 className="text-base font-semibold text-slate-950">{ticket.issueSummary}</h2>
                    <p className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {ticket.customerQuestion}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <InfoTile label="客户" value={`${ticket.customerName}${ticket.customerTier ? ` / ${ticket.customerTier}` : ""}`} />
                    <InfoTile label="订单" value={ticket.orderNo || "-"} subValue={ticket.orderStatus || undefined} />
                    <InfoTile label="商品" value={ticket.productName || "-"} subValue={ticket.productSku || undefined} />
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="border-b border-slate-100 px-4 py-3">
                      <h3 className="text-sm font-semibold text-slate-950">AI 回复工作区</h3>
                    </div>
                    <div className="space-y-4 p-4">
                      <Field label="补充要求">
                        <Input value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="例如：回复更简短，重点说明退货运费规则" />
                      </Field>
                      <div className="flex flex-wrap gap-2">
                        <Button disabled={replyMutation.isPending} onClick={() => replyMutation.mutate()}>
                          <Bot className="h-4 w-4" />
                          {replyMutation.isPending ? "生成中..." : "生成客服回复"}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={saveReplyMutation.isPending || !draftReply.trim() || !ticket}
                          onClick={() => saveReplyMutation.mutate()}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {saveReplyMutation.isPending ? "保存中..." : "保存回复"}
                        </Button>
                      </div>
                      <Textarea
                        className="min-h-44"
                        value={draftReply}
                        onChange={(event) => setDraftReply(event.target.value)}
                        placeholder="生成后的客服回复会出现在这里，也可以手动编辑。"
                      />
                      <CitationList chat={lastChat} />
                    </div>
                  </div>
                </section>

                <aside className="space-y-4">
                  <ContextPanel ticket={ticket} knowledgeBase={selectedKnowledgeBase} />
                </aside>
              </div>
            </>
          ) : null}
        </Panel>
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

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function StatusBadge({ value }: { value: SupportTicketStatus }) {
  const tone = value === "RESOLVED" || value === "CLOSED" ? "green" : value === "OPEN" ? "amber" : "cyan";
  return <Badge tone={tone}>{statusLabels[value]}</Badge>;
}

function PriorityBadge({ value }: { value: SupportTicketPriority }) {
  const tone = value === "URGENT" ? "rose" : value === "HIGH" ? "amber" : value === "NORMAL" ? "slate" : "green";
  return <Badge tone={tone}>{priorityLabels[value]}</Badge>;
}

function InfoTile({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 min-w-0 break-words text-sm font-medium text-slate-900">{value}</p>
      {subValue ? <p className="mt-1 text-xs text-slate-500">{subValue}</p> : null}
    </div>
  );
}

function ContextPanel({ ticket, knowledgeBase }: { ticket: SupportTicketResponse; knowledgeBase?: KnowledgeBaseResponse }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-emerald-700" />
        <h3 className="text-sm font-semibold text-slate-950">业务上下文</h3>
      </div>
      <dl className="space-y-3 text-sm">
        <Meta label="知识库" value={knowledgeBase?.name || ticket.knowledgeBaseName} />
        <Meta label="渠道" value={ticket.channel} />
        <Meta label="联系方式" value={ticket.customerContact || "-"} />
        <Meta label="购买时间" value={formatDateTime(ticket.purchasedAt)} />
        <Meta label="最近更新" value={formatDateTime(ticket.updatedAt)} />
        <Meta label="AI 会话" value={ticket.aiConversationId ? shortId(ticket.aiConversationId) : "-"} />
      </dl>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-slate-700">{value}</dd>
    </div>
  );
}

function CitationList({ chat }: { chat: ChatResponse | null }) {
  if (!chat) {
    return null;
  }
  if (chat.citations.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        {chat.answerStatus === "NO_CONTEXT" || chat.answerStatus === "EMPTY_KB" ? "本次没有可用引用，已按知识缺口记录。" : "本次回答没有引用来源。"}
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
        <MessageSquareText className="h-4 w-4 text-emerald-700" />
        引用来源
      </div>
      <div className="space-y-2">
        {chat.citations.map((citation) => (
          <div key={citation.chunkId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium text-slate-900">
              {citation.fileName} #{citation.chunkIndex}
            </p>
            <p className="mt-1 line-clamp-2 text-slate-500">{citation.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateTicketModal({
  open,
  knowledgeBases,
  pending,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  knowledgeBases: KnowledgeBaseResponse[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (payload: SupportTicketRequest) => void;
}) {
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [category, setCategory] = useState("退货退款");
  const [channel, setChannel] = useState("在线客服");
  const [customerName, setCustomerName] = useState("");
  const [customerTier, setCustomerTier] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("NORMAL");
  const [issueSummary, setIssueSummary] = useState("");
  const [customerQuestion, setCustomerQuestion] = useState("");

  useEffect(() => {
    if (open && !knowledgeBaseId && knowledgeBases[0]) {
      setKnowledgeBaseId(knowledgeBases[0].id);
    }
  }, [knowledgeBaseId, knowledgeBases, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      knowledgeBaseId,
      status: "OPEN",
      priority,
      category,
      channel,
      customerName,
      customerTier,
      orderNo,
      orderStatus,
      productName,
      productSku,
      issueSummary,
      customerQuestion
    });
  }

  return (
    <Modal open={open} title="新建售后工单" description="用模拟客户、订单和商品信息承载知识库问答场景。" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="绑定知识库">
          <Select value={knowledgeBaseId} onChange={setKnowledgeBaseId}>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="分类">
            <Input value={category} onChange={(event) => setCategory(event.target.value)} required maxLength={80} />
          </Field>
          <Field label="渠道">
            <Input value={channel} onChange={(event) => setChannel(event.target.value)} required maxLength={40} />
          </Field>
          <Field label="客户">
            <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required maxLength={120} />
          </Field>
          <Field label="客户层级">
            <Input value={customerTier} onChange={(event) => setCustomerTier(event.target.value)} maxLength={40} />
          </Field>
          <Field label="订单号">
            <Input value={orderNo} onChange={(event) => setOrderNo(event.target.value)} maxLength={80} />
          </Field>
          <Field label="订单状态">
            <Input value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} maxLength={80} />
          </Field>
          <Field label="商品">
            <Input value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={160} />
          </Field>
          <Field label="SKU">
            <Input value={productSku} onChange={(event) => setProductSku(event.target.value)} maxLength={80} />
          </Field>
          <Field label="优先级">
            <Select value={priority} onChange={(value) => setPriority(value as SupportTicketPriority)}>
              {priorityOptions.filter(Boolean).map((item) => (
                <option key={item} value={item}>
                  {priorityLabels[item as SupportTicketPriority]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="问题摘要">
          <Input value={issueSummary} onChange={(event) => setIssueSummary(event.target.value)} required maxLength={300} />
        </Field>
        <Field label="客户原问题">
          <Textarea value={customerQuestion} onChange={(event) => setCustomerQuestion(event.target.value)} required />
        </Field>
        <ErrorMessage error={error} />
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={pending || !knowledgeBaseId || !customerName.trim() || !issueSummary.trim() || !customerQuestion.trim()}>
            <Plus className="h-4 w-4" />
            {pending ? "创建中..." : "创建工单"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function toTicketRequest(ticket: SupportTicketResponse | null, latestAiReply: string): SupportTicketRequest {
  if (!ticket) {
    throw new Error("请先选择工单");
  }
  return {
    knowledgeBaseId: ticket.knowledgeBaseId,
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
    issueSummary: ticket.issueSummary,
    customerQuestion: ticket.customerQuestion,
    latestAiReply
  };
}
