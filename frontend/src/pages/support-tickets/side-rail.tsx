import { Archive, GitBranch, LockKeyhole, NotebookPen, RotateCcw, UserCheck, UserMinus } from "lucide-react";
import { Button, Textarea } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import type { SupportTicketEventResponse, SupportTicketResponse, SupportTicketStatus } from "../../types";
import { eventLabels, statusLabels, workflowStatuses } from "./constants";
export function TicketSideRail({
  ticket,
  currentUserId,
  internalNote,
  events,
  loadingEvents,
  busy,
  onAssignToMe,
  onUnassign,
  onStatusChange,
  onClose,
  onReopen,
  onNoteChange,
  onAddNote
}: {
  ticket: SupportTicketResponse;
  currentUserId: string | null;
  internalNote: string;
  events: SupportTicketEventResponse[];
  loadingEvents: boolean;
  busy: boolean;
  onAssignToMe: () => void;
  onUnassign: () => void;
  onStatusChange: (status: SupportTicketStatus) => void;
  onClose: () => void;
  onReopen: () => void;
  onNoteChange: (value: string) => void;
  onAddNote: () => void;
}) {
  return (
    <aside className="min-w-0 space-y-4 xl:col-start-2 2xl:col-start-auto 2xl:row-start-1 2xl:sticky 2xl:top-20 2xl:self-start">
      <ActionPanel
        ticket={ticket}
        currentUserId={currentUserId}
        internalNote={internalNote}
        busy={busy}
        onAssignToMe={onAssignToMe}
        onUnassign={onUnassign}
        onStatusChange={onStatusChange}
        onClose={onClose}
        onReopen={onReopen}
        onNoteChange={onNoteChange}
        onAddNote={onAddNote}
      />
      <Timeline events={events} loading={loadingEvents} />
    </aside>
  );
}

function ActionPanel({
  ticket,
  currentUserId,
  internalNote,
  busy,
  onAssignToMe,
  onUnassign,
  onStatusChange,
  onClose,
  onReopen,
  onNoteChange,
  onAddNote
}: {
  ticket: SupportTicketResponse;
  currentUserId: string | null;
  internalNote: string;
  busy: boolean;
  onAssignToMe: () => void;
  onUnassign: () => void;
  onStatusChange: (status: SupportTicketStatus) => void;
  onClose: () => void;
  onReopen: () => void;
  onNoteChange: (value: string) => void;
  onAddNote: () => void;
}) {
  const statusChoices = workflowStatuses.filter((item) => ticket.allowedStatuses.includes(item) && item !== "CLOSED");
  const canWorkActiveTicket = ticket.canWork && ticket.status !== "CLOSED";

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-900/5">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <GitBranch className="h-4 w-4 text-emerald-700" />
          处理动作
        </h3>
      </div>
      <div className="space-y-5 p-4">
        {!canWorkActiveTicket ? (
          <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>{ticket.status === "CLOSED" ? "工单已关闭，需要重开后才能继续处理。" : "你可以查看这个工单；处理、回复和流转需要知识库资料维护权限。"}</p>
          </div>
        ) : null}

        <div>
          <p className="text-xs text-slate-400">当前负责人</p>
          <p className="mt-1 truncate text-base font-semibold text-slate-900">{ticket.assigneeName || "未分配"}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button className="w-full" size="sm" variant="secondary" disabled={busy || !canWorkActiveTicket || !currentUserId || ticket.assigneeId === currentUserId} onClick={onAssignToMe}>
              <UserCheck className="h-4 w-4" />
              分配给我
            </Button>
            <Button className="w-full" size="sm" variant="ghost" disabled={busy || !canWorkActiveTicket || !ticket.assigneeId} onClick={onUnassign}>
              <UserMinus className="h-4 w-4" />
              取消负责人
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-slate-400">状态流转</p>
          <div className="grid grid-cols-2 gap-2">
            {statusChoices.map((item) => (
              <Button key={item} className="w-full" size="sm" variant={ticket.status === item ? "primary" : "secondary"} disabled={busy || ticket.status === item} onClick={() => onStatusChange(item)}>
                {statusLabels[item]}
              </Button>
            ))}
          </div>
          {statusChoices.length === 0 ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">当前状态暂无可用流转。</p> : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button className="w-full" size="sm" variant="danger" disabled={busy || !ticket.canClose} onClick={onClose}>
              <Archive className="h-4 w-4" />
              关闭
            </Button>
            <Button className="w-full" size="sm" variant="secondary" disabled={busy || !ticket.canReopen} onClick={onReopen}>
              <RotateCcw className="h-4 w-4" />
              重开
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-slate-400">内部备注</p>
          <Textarea className="min-h-24 resize-none" value={internalNote} disabled={!canWorkActiveTicket} onChange={(event) => onNoteChange(event.target.value)} placeholder="记录处理判断、电话沟通或下一步动作。" />
          <Button className="mt-2 w-full" size="sm" disabled={busy || !canWorkActiveTicket || !internalNote.trim()} onClick={onAddNote}>
            <NotebookPen className="h-4 w-4" />
            添加备注
          </Button>
        </div>
      </div>
    </section>
  );
}

function Timeline({ events, loading }: { events: SupportTicketEventResponse[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm shadow-slate-900/5">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">处理时间线</h3>
      </div>
      <div className="max-h-[26rem] space-y-3 overflow-y-auto p-4">
        {loading ? <p className="text-sm text-slate-500">正在加载时间线...</p> : null}
        {!loading && events.length === 0 ? <p className="text-sm text-slate-500">暂无处理记录。</p> : null}
        {events.map((event) => (
          <div key={event.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="font-medium text-slate-900">{eventLabels[event.eventType]}</p>
              <span className="shrink-0 text-xs text-slate-400">{formatDateTime(event.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{event.actorName || "未知用户"}</p>
            <p className="mt-2 break-words text-slate-700">{eventText(event)}</p>
            {event.note ? <p className="mt-2 break-words rounded-md bg-slate-50 p-2 text-slate-600">{event.note}</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function eventText(event: SupportTicketEventResponse) {
  if (event.eventType === "STATUS_CHANGED") {
    const from = event.fromStatus ? statusLabels[event.fromStatus] : "无";
    const to = event.toStatus ? statusLabels[event.toStatus] : "无";
    return `${from} -> ${to}`;
  }
  if (event.eventType === "ASSIGNED") {
    return `${event.fromAssigneeName || "未分配"} -> ${event.toAssigneeName || "未分配"}`;
  }
  if (event.eventType === "AI_REPLY_GENERATED") {
    return "已根据工单上下文生成回复草稿。";
  }
  if (event.eventType === "REPLY_SAVED") {
    return "已保存客服回复草稿。";
  }
  if (event.eventType === "CUSTOMER_MESSAGE") {
    return "客户补充了一条信息。";
  }
  if (event.eventType === "AGENT_REPLY_SENT") {
    return "客服回复已记录为外发消息。";
  }
  if (event.eventType === "INTERNAL_NOTE") {
    return "新增一条内部处理记录。";
  }
  return "工单已进入处理队列。";
}

