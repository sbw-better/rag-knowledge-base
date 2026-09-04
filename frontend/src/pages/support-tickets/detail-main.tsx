import { Bot, CheckCircle2, MessageSquareText } from "lucide-react";
import { Badge, Button, Input, Textarea } from "../../components/ui";
import { formatDateTime, shortId } from "../../lib/utils";
import type { ChatResponse, SupportTicketResponse } from "../../types";
import { PriorityBadge, SlaBadge, StatusBadge, InfoTile, Meta } from "./shared";
export function TicketDetailMain({
  ticket,
  draftReply,
  instruction,
  chat,
  generating,
  saving,
  onInstructionChange,
  onDraftReplyChange,
  onGenerate,
  onSave
}: {
  ticket: SupportTicketResponse;
  draftReply: string;
  instruction: string;
  chat: ChatResponse | null;
  generating: boolean;
  saving: boolean;
  onInstructionChange: (value: string) => void;
  onDraftReplyChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-5 p-5 lg:p-6">
      <TicketHeader ticket={ticket} />
      <CustomerQuestion ticket={ticket} />
      <BusinessStrip ticket={ticket} />
      <ReplyEditor
        draftReply={draftReply}
        instruction={instruction}
        chat={chat}
        generating={generating}
        saving={saving}
        onInstructionChange={onInstructionChange}
        onDraftReplyChange={onDraftReplyChange}
        onGenerate={onGenerate}
        onSave={onSave}
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

function ReplyEditor({
  draftReply,
  instruction,
  chat,
  generating,
  saving,
  onInstructionChange,
  onDraftReplyChange,
  onGenerate,
  onSave
}: {
  draftReply: string;
  instruction: string;
  chat: ChatResponse | null;
  generating: boolean;
  saving: boolean;
  onInstructionChange: (value: string) => void;
  onDraftReplyChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">AI 回复草稿</h3>
          <p className="mt-0.5 text-xs text-slate-500">生成后可直接编辑，再保存到工单。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={generating} onClick={onGenerate}>
            <Bot className="h-4 w-4" />
            {generating ? "生成中" : "生成回复"}
          </Button>
          <Button size="sm" variant="secondary" disabled={saving || !draftReply.trim()} onClick={onSave}>
            <CheckCircle2 className="h-4 w-4" />
            {saving ? "保存中" : "保存"}
          </Button>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <Input value={instruction} onChange={(event) => onInstructionChange(event.target.value)} placeholder="补充要求，例如：更简短、突出退货运费规则" />
        <Textarea
          className="min-h-48"
          value={draftReply}
          onChange={(event) => onDraftReplyChange(event.target.value)}
          placeholder="AI 回复会出现在这里。"
        />
        <CitationList chat={chat} />
      </div>
    </section>
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
