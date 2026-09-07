import { AlertTriangle, Bot, Check, CheckCircle2, MessageCircleWarning, MessageSquareReply, MessageSquareText, RotateCw, Send, ShieldCheck, StickyNote, ThumbsDown, ThumbsUp, UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Input, Modal, Textarea } from "../../components/ui";
import { formatDateTime, shortId } from "../../lib/utils";
import type { BusinessFeedbackLinksResponse, ChatResponse, KnowledgeIssueResponse, SupportTicketEventResponse, SupportTicketResponse } from "../../types";
import { statusLabels } from "./constants";
import { KnowledgeIssueRechecks } from "../../components/KnowledgeIssueRechecks";
import { PriorityBadge, SlaBadge, StatusBadge, InfoTile, Meta } from "./shared";
export function TicketDetailMain({
  ticket,
  draftReply,
  instruction,
  events,
  loadingEvents,
  customerMessage,
  feedbackLinks,
  loadingFeedbackLinks,
  chat,
  generating,
  saving,
  sendingReply,
  addingCustomerMessage,
  resolvingIssue,
  onInstructionChange,
  onDraftReplyChange,
  onCustomerMessageChange,
  onGenerate,
  onSave,
  onSendReply,
  onAddCustomerMessage,
  onResolveIssue,
  onRetestIssue
}: {
  ticket: SupportTicketResponse;
  draftReply: string;
  instruction: string;
  events: SupportTicketEventResponse[];
  loadingEvents: boolean;
  customerMessage: string;
  feedbackLinks?: BusinessFeedbackLinksResponse;
  loadingFeedbackLinks: boolean;
  chat: ChatResponse | null;
  generating: boolean;
  saving: boolean;
  sendingReply: boolean;
  addingCustomerMessage: boolean;
  resolvingIssue: boolean;
  onInstructionChange: (value: string) => void;
  onDraftReplyChange: (value: string) => void;
  onCustomerMessageChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onSendReply: () => void;
  onAddCustomerMessage: () => void;
  onResolveIssue: (issueId: string) => void;
  onRetestIssue: (question: string) => void;
}) {
  const canWorkActiveTicket = ticket.canWork && ticket.status !== "CLOSED";

  return (
    <div className="space-y-5 p-5 lg:p-6">
      <TicketHeader ticket={ticket} />
      <CustomerQuestion ticket={ticket} />
      <BusinessStrip ticket={ticket} />
      <CommunicationPanel
        ticket={ticket}
        events={events}
        loading={loadingEvents}
        customerMessage={customerMessage}
        adding={addingCustomerMessage}
        canWork={canWorkActiveTicket}
        onCustomerMessageChange={onCustomerMessageChange}
        onAddCustomerMessage={onAddCustomerMessage}
      />
      <ReplyEditor
        ticket={ticket}
        draftReply={draftReply}
        instruction={instruction}
        chat={chat}
        generating={generating}
        saving={saving}
        sendingReply={sendingReply}
        canWork={canWorkActiveTicket}
        onInstructionChange={onInstructionChange}
        onDraftReplyChange={onDraftReplyChange}
        onGenerate={onGenerate}
        onSave={onSave}
        onSendReply={onSendReply}
      />
      <KnowledgeClosurePanel
        links={feedbackLinks}
        loading={loadingFeedbackLinks}
        resolving={resolvingIssue}
        generating={generating}
        canResolve={ticket.canClose || ticket.canReopen}
        onResolveIssue={onResolveIssue}
        onRetestIssue={onRetestIssue}
      />
    </div>
  );
}

function TicketHeader({ ticket }: { ticket: SupportTicketResponse }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <StatusBadge value={ticket.status} />
          <PriorityBadge value={ticket.priority} />
          <SlaBadge ticket={ticket} />
          {ticket.latestAiReply ? <Badge tone="green">已有回复</Badge> : null}
        </div>
        <h2 className="break-words text-xl font-semibold tracking-normal text-slate-950">{ticket.issueSummary}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {ticket.ticketNo} · {ticket.knowledgeBaseName} · 更新于 {formatDateTime(ticket.updatedAt)}
        </p>
      </div>
    </div>
  );
}

function CustomerQuestion({ ticket }: { ticket: SupportTicketResponse }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">客户问题</h3>
        <span className="text-xs text-slate-400">{ticket.channel}</span>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{ticket.customerQuestion}</p>
      </div>
    </section>
  );
}

function BusinessStrip({ ticket }: { ticket: SupportTicketResponse }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-slate-950">业务信息</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <InfoTile label="客户" value={`${ticket.customerName}${ticket.customerTier ? ` / ${ticket.customerTier}` : ""}`} />
        <InfoTile label="订单" value={ticket.orderNo || "-"} subValue={ticket.orderStatus || undefined} />
        <InfoTile label="商品" value={ticket.productName || "-"} subValue={ticket.productSku || undefined} />
      </div>
      <details className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none text-slate-600">更多上下文</summary>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Meta label="负责人" value={ticket.assigneeName || "未分配"} />
          <Meta label="SLA 截止" value={formatDateTime(ticket.dueAt)} />
          <Meta label="联系方式" value={ticket.customerContact || "-"} />
          <Meta label="购买时间" value={formatDateTime(ticket.purchasedAt)} />
          <Meta label="AI 会话" value={ticket.aiConversationId ? shortId(ticket.aiConversationId) : "-"} />
          <Meta label="创建时间" value={formatDateTime(ticket.createdAt)} />
        </dl>
      </details>
    </section>
  );
}

function CommunicationPanel({
  ticket,
  events,
  loading,
  customerMessage,
  adding,
  canWork,
  onCustomerMessageChange,
  onAddCustomerMessage
}: {
  ticket: SupportTicketResponse;
  events: SupportTicketEventResponse[];
  loading: boolean;
  customerMessage: string;
  adding: boolean;
  canWork: boolean;
  onCustomerMessageChange: (value: string) => void;
  onAddCustomerMessage: () => void;
}) {
  const messages = events
    .filter((event) => event.eventType === "CUSTOMER_MESSAGE" || event.eventType === "AGENT_REPLY_SENT" || event.eventType === "INTERNAL_NOTE")
    .slice()
    .reverse();

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">沟通记录</h3>
          <p className="mt-0.5 text-xs text-slate-500">客户补充、客服外发和内部备注分流展示。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="cyan">客户</Badge>
          <Badge tone="green">客服</Badge>
          <Badge tone="slate">内部</Badge>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <ConversationBubble
          tone="customer"
          title={`${ticket.customerName} 的原问题`}
          time={formatDateTime(ticket.createdAt)}
          content={ticket.customerQuestion}
        />
        {loading ? <p className="text-sm text-slate-500">正在加载沟通记录...</p> : null}
        {messages.map((event) => (
          <ConversationBubble
            key={event.id}
            tone={event.eventType === "CUSTOMER_MESSAGE" ? "customer" : event.eventType === "AGENT_REPLY_SENT" ? "agent" : "internal"}
            title={communicationTitle(event)}
            time={formatDateTime(event.createdAt)}
            content={event.note || "-"}
          />
        ))}
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
          <Textarea
            className="min-h-20 resize-none"
            value={customerMessage}
            disabled={!canWork}
            onChange={(event) => onCustomerMessageChange(event.target.value)}
            placeholder="记录客户追加说明，例如：照片已补充、联系方式变更、愿意等待换货。"
          />
          <Button className="mt-2 w-full sm:w-auto" size="sm" disabled={adding || !canWork || !customerMessage.trim()} onClick={onAddCustomerMessage}>
            <UserRoundPlus className="h-4 w-4" />
            {adding ? "记录中" : "记录客户补充"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function ConversationBubble({
  tone,
  title,
  time,
  content
}: {
  tone: "customer" | "agent" | "internal";
  title: string;
  time: string;
  content: string;
}) {
  const toneClass =
    tone === "customer"
      ? "border-cyan-200 bg-cyan-50/70"
      : tone === "agent"
        ? "border-emerald-200 bg-emerald-50/70"
        : "border-slate-200 bg-slate-50";
  const icon =
    tone === "customer" ? <UserRoundPlus className="h-4 w-4 text-cyan-700" /> : tone === "agent" ? <MessageSquareReply className="h-4 w-4 text-emerald-700" /> : <StickyNote className="h-4 w-4 text-slate-500" />;
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900">
          <span className="shrink-0">{icon}</span>
          <span className="truncate">{title}</span>
        </p>
        <span className="shrink-0 text-xs text-slate-400">{time}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{content}</p>
    </div>
  );
}

function communicationTitle(event: SupportTicketEventResponse) {
  if (event.eventType === "CUSTOMER_MESSAGE") {
    return "客户补充";
  }
  if (event.eventType === "AGENT_REPLY_SENT") {
    return `${event.actorName || "客服"} 外发回复`;
  }
  return `${event.actorName || "处理人"} 的内部备注`;
}

function ReplyEditor({
  ticket,
  draftReply,
  instruction,
  chat,
  generating,
  saving,
  sendingReply,
  canWork,
  onInstructionChange,
  onDraftReplyChange,
  onGenerate,
  onSave,
  onSendReply
}: {
  ticket: SupportTicketResponse;
  draftReply: string;
  instruction: string;
  chat: ChatResponse | null;
  generating: boolean;
  saving: boolean;
  sendingReply: boolean;
  canWork: boolean;
  onInstructionChange: (value: string) => void;
  onDraftReplyChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onSendReply: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const trimmedReply = draftReply.trim();
  const nextStatus = ticket.status === "RESOLVED" ? "RESOLVED" : "WAITING_CUSTOMER";

  function openConfirm() {
    setChecked(false);
    setConfirmOpen(true);
  }

  function confirmSend() {
    onSendReply();
    setConfirmOpen(false);
  }

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">AI 回复草稿</h3>
            <p className="mt-0.5 text-xs text-slate-500">生成后可直接编辑；外发前需要二次确认。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={generating || !canWork} onClick={onGenerate}>
              <Bot className="h-4 w-4" />
              {generating ? "生成中" : "生成回复"}
            </Button>
            <Button size="sm" variant="secondary" disabled={saving || !canWork || !trimmedReply} onClick={onSave}>
              <CheckCircle2 className="h-4 w-4" />
              {saving ? "保存中" : "保存"}
            </Button>
            <Button size="sm" variant="secondary" disabled={sendingReply || !canWork || !trimmedReply} onClick={openConfirm}>
              <Send className="h-4 w-4" />
              {sendingReply ? "发送中" : "外发回复"}
            </Button>
          </div>
        </div>
        <div className="space-y-3 p-4">
          <Input value={instruction} disabled={!canWork} onChange={(event) => onInstructionChange(event.target.value)} placeholder="补充要求，例如：更简短、突出退货运费规则" />
          <Textarea
            className="min-h-48"
            value={draftReply}
            disabled={!canWork}
            onChange={(event) => onDraftReplyChange(event.target.value)}
            placeholder="AI 回复会出现在这里。"
          />
          <CitationList chat={chat} />
        </div>
      </section>

      <Modal open={confirmOpen} title="确认外发回复" description="外发后会进入沟通记录，并同步更新工单状态。" onClose={() => setConfirmOpen(false)}>
        <div className="space-y-4 p-5">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">发送对象</p>
              <p className="mt-1 font-medium text-slate-900">{ticket.customerName}</p>
              <p className="mt-1 break-words text-xs text-slate-500">{ticket.customerContact || "未填写联系方式"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">工单与状态</p>
              <p className="mt-1 font-medium text-slate-900">{ticket.ticketNo}</p>
              <p className="mt-1 text-xs text-slate-500">
                {statusLabels[ticket.status]} {"->"} {statusLabels[nextStatus]}
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>请确认回复内容、客户对象和工单状态无误；确认后会作为客服外发消息写入时间线。</p>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-medium text-slate-500">外发内容 · {trimmedReply.length} 字</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">{trimmedReply}</p>
          </div>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <input className="mt-1 h-4 w-4 shrink-0 accent-emerald-600" type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            <span>我已核对客户、工单和回复内容，确认外发。</span>
          </label>
          <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={sendingReply || !checked || !trimmedReply} onClick={confirmSend}>
              <ShieldCheck className="h-4 w-4" />
              {sendingReply ? "发送中" : "确认外发"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function KnowledgeClosurePanel({
  links,
  loading,
  resolving,
  generating,
  canResolve,
  onResolveIssue,
  onRetestIssue
}: {
  links?: BusinessFeedbackLinksResponse;
  loading: boolean;
  resolving: boolean;
  generating: boolean;
  canResolve: boolean;
  onResolveIssue: (issueId: string) => void;
  onRetestIssue: (question: string) => void;
}) {
  const issues = links?.issues ?? [];
  const feedbacks = links?.feedbacks ?? [];
  const openCount = issues.filter((issue) => issue.status === "OPEN").length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">知识闭环</h3>
          <p className="mt-0.5 text-xs text-slate-500">查看该工单触发的知识缺口和回答反馈，处理后可复检生成回复。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={openCount > 0 ? "amber" : "slate"}>待处理 {loading ? "-" : openCount}</Badge>
          <Badge tone="cyan">反馈 {loading ? "-" : feedbacks.length}</Badge>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {loading ? <p className="text-sm text-slate-500">正在加载闭环数据...</p> : null}
        {!loading && issues.length === 0 && feedbacks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            当前工单还没有关联知识缺口或回答反馈。
          </div>
        ) : null}
        {issues.map((issue) => (
          <KnowledgeIssueCard
            key={issue.id}
            issue={issue}
            resolving={resolving}
            generating={generating}
            canResolve={canResolve}
            onResolve={() => onResolveIssue(issue.id)}
            onRetest={() => onRetestIssue(issue.question)}
          />
        ))}
        {feedbacks.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {feedbacks.map((feedback) => (
              <div key={feedback.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                  {feedback.rating === "HELPFUL" ? <ThumbsUp className="h-4 w-4 text-emerald-700" /> : <ThumbsDown className="h-4 w-4 text-rose-700" />}
                  {feedback.rating === "HELPFUL" ? "有用反馈" : "需补充反馈"}
                </div>
                {feedback.reason ? <p className="mt-2 text-xs text-slate-500">原因：{feedback.reason}</p> : null}
                {feedback.comment ? <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm leading-5 text-slate-600">{feedback.comment}</p> : null}
                <p className="mt-2 text-xs text-slate-400">{formatDateTime(feedback.updatedAt)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function KnowledgeIssueCard({
  issue,
  resolving,
  generating,
  canResolve,
  onResolve,
  onRetest
}: {
  issue: KnowledgeIssueResponse;
  resolving: boolean;
  generating: boolean;
  canResolve: boolean;
  onResolve: () => void;
  onRetest: () => void;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={issue.status === "OPEN" ? "amber" : "green"}>{issue.status === "OPEN" ? "待处理" : "已处理"}</Badge>
            <Badge tone={issue.source === "NEGATIVE_FEEDBACK" ? "rose" : "slate"}>{issue.source === "NEGATIVE_FEEDBACK" ? "反馈触发" : "未命中"}</Badge>
            <span className="text-xs text-slate-400">{formatDateTime(issue.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-slate-900">{issue.question}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {issue.status === "OPEN" ? (
            <Button type="button" size="sm" variant="secondary" disabled={resolving || !canResolve} onClick={onResolve}>
              <Check className="h-4 w-4" />
              处理并复检
            </Button>
          ) : (
            <Button type="button" size="sm" variant="secondary" disabled={generating || !canResolve} onClick={onRetest}>
              <RotateCw className="h-4 w-4" />
              生成新回复
            </Button>
          )}
        </div>
      </div>
      {issue.comment ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-amber-700">{issue.comment}</p> : null}
      {issue.answerSummary ? (
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap break-words rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-500">
          {issue.answerSummary}
        </p>
      ) : null}
      {issue.resolutionNote ? (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
          <MessageCircleWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {issue.resolutionNote}
        </p>
      ) : null}
      <KnowledgeIssueRechecks issue={issue} canRecheck={canResolve && !resolving} />
    </article>
  );
}

function CitationList({ chat }: { chat: ChatResponse | null }) {
  if (!chat) {
    return null;
  }
  if (chat.citations.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
        {chat.answerStatus === "NO_CONTEXT" || chat.answerStatus === "EMPTY_KB" ? "没有可用引用，已记录到知识缺口。" : "本次回答没有引用来源。"}
      </div>
    );
  }
  return (
    <details className="rounded-lg border border-slate-200 bg-slate-50 p-3" open>
      <summary className="flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-slate-800">
        <MessageSquareText className="h-4 w-4 text-emerald-700" />
        引用来源
      </summary>
      <div className="mt-3 space-y-2">
        {chat.citations.map((citation) => (
          <div key={citation.chunkId} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <p className="font-medium text-slate-900">
              {citation.fileName} #{citation.chunkIndex}
            </p>
            <p className="mt-1 line-clamp-2 text-slate-500">{citation.snippet}</p>
          </div>
        ))}
      </div>
    </details>
  );
}
