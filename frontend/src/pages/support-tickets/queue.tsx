import { CheckSquare, Search, Sparkles, Square, UserCheck, X } from "lucide-react";
import { Badge, Button, EmptyState, ErrorMessage, Input, Pagination, Panel } from "../../components/ui";
import { cn } from "../../lib/utils";
import type { SupportTicketPriority, SupportTicketResponse, SupportTicketStatus } from "../../types";
import { priorityLabels, priorityOptions, statusLabels, statusOptions } from "./constants";
import { PriorityIcon, Select, SlaBadge, StatusDot } from "./shared";
export type TicketQueueStats = {
  open: number;
  inProgress: number;
  waitingCustomer: number;
  overdue: number;
  loading: boolean;
};

export function TicketQueue({
  tickets,
  activeTicketId,
  total,
  page,
  pageSize,
  loading,
  error,
  keyword,
  status,
  priority,
  mineOnly,
  overdueOnly,
  stats,
  selectedIds,
  batchBusy,
  canAssignToMe,
  canGenerateReply,
  batchAllowedStatuses,
  onKeywordChange,
  onStatusChange,
  onPriorityChange,
  onMineOnlyChange,
  onOverdueOnlyChange,
  onToggleSelected,
  onTogglePageSelected,
  onClearSelected,
  onBatchAssignToMe,
  onBatchGenerateReplies,
  onBatchStatusChange,
  onOpen,
  onPageChange
}: {
  tickets: SupportTicketResponse[];
  activeTicketId?: string;
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  error: unknown;
  keyword: string;
  status: SupportTicketStatus | "";
  priority: SupportTicketPriority | "";
  mineOnly: boolean;
  overdueOnly: boolean;
  stats: TicketQueueStats;
  selectedIds: string[];
  batchBusy: boolean;
  canAssignToMe: boolean;
  canGenerateReply: boolean;
  batchAllowedStatuses: SupportTicketStatus[];
  onKeywordChange: (value: string) => void;
  onStatusChange: (value: SupportTicketStatus | "") => void;
  onPriorityChange: (value: SupportTicketPriority | "") => void;
  onMineOnlyChange: (value: boolean) => void;
  onOverdueOnlyChange: (value: boolean) => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onTogglePageSelected: (checked: boolean) => void;
  onClearSelected: () => void;
  onBatchAssignToMe: () => void;
  onBatchGenerateReplies: () => void;
  onBatchStatusChange: (status: SupportTicketStatus) => void;
  onOpen: (id: string) => void;
  onPageChange: (page: number) => void;
}) {
  const selectedSet = new Set(selectedIds);
  const selectableCount = tickets.length;
  const selectedOnPage = tickets.filter((item) => selectedSet.has(item.id)).length;
  const pageChecked = selectableCount > 0 && selectedOnPage === selectableCount;

  return (
    <Panel className="overflow-hidden xl:sticky xl:top-20 xl:self-start">
      <div className="border-b border-slate-100 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">工单队列</h2>
            <p className="mt-0.5 text-xs text-slate-500">当前筛选共 {total} 条</p>
          </div>
          <Badge tone="slate">{status ? statusLabels[status] : "全部"}</Badge>
        </div>
        <QueueStats stats={stats} status={status} overdueOnly={overdueOnly} onStatusChange={onStatusChange} onOverdueOnlyChange={onOverdueOnlyChange} />
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" value={keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="搜索客户、订单或问题" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={status} onChange={(value) => onStatusChange(value as SupportTicketStatus | "")}>
              {statusOptions.map((item) => (
                <option key={item || "ALL"} value={item}>
                  {item ? statusLabels[item] : "全部状态"}
                </option>
              ))}
            </Select>
            <Select value={priority} onChange={(value) => onPriorityChange(value as SupportTicketPriority | "")}>
              {priorityOptions.map((item) => (
                <option key={item || "ALL"} value={item}>
                  {item ? priorityLabels[item] : "全部优先级"}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            <Toggle checked={mineOnly} label="只看我的" onChange={onMineOnlyChange} />
            <Toggle checked={overdueOnly} label="只看逾期" onChange={onOverdueOnlyChange} />
          </div>
          <BulkToolbar
            count={selectedIds.length}
            pageChecked={pageChecked}
            disabled={selectableCount === 0}
            busy={batchBusy}
            canAssignToMe={canAssignToMe}
            canGenerateReply={canGenerateReply}
            allowedStatuses={batchAllowedStatuses}
            onTogglePage={onTogglePageSelected}
            onClear={onClearSelected}
            onAssignToMe={onBatchAssignToMe}
            onGenerateReplies={onBatchGenerateReplies}
            onStatusChange={onBatchStatusChange}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? <p className="p-4 text-sm text-slate-500">正在加载工单...</p> : null}
        <ErrorMessage error={error} />
        {!loading && total === 0 ? (
          <div className="p-4">
            <EmptyState title="暂无工单" description="可以新建工单，或生成几条示例工单用于演示。" />
          </div>
        ) : null}
        {tickets.map((item) => (
          <TicketListItem
            key={item.id}
            ticket={item}
            active={item.id === activeTicketId}
            selected={selectedSet.has(item.id)}
            onSelectedChange={(checked) => onToggleSelected(item.id, checked)}
            onOpen={() => onOpen(item.id)}
          />
        ))}
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={onPageChange} />
    </Panel>
  );
}

function BulkToolbar({
  count,
  pageChecked,
  disabled,
  busy,
  canAssignToMe,
  canGenerateReply,
  allowedStatuses,
  onTogglePage,
  onClear,
  onAssignToMe,
  onGenerateReplies,
  onStatusChange
}: {
  count: number;
  pageChecked: boolean;
  disabled: boolean;
  busy: boolean;
  canAssignToMe: boolean;
  canGenerateReply: boolean;
  allowedStatuses: SupportTicketStatus[];
  onTogglePage: (checked: boolean) => void;
  onClear: () => void;
  onAssignToMe: () => void;
  onGenerateReplies: () => void;
  onStatusChange: (status: SupportTicketStatus) => void;
}) {
  const hasSelection = count > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <label className="flex h-8 min-w-0 cursor-pointer select-none items-center gap-2 rounded-md px-2 text-xs text-slate-600 transition hover:bg-slate-50">
          <input
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            type="checkbox"
            checked={pageChecked}
            disabled={disabled || busy}
            onChange={(event) => onTogglePage(event.target.checked)}
          />
          <span className="truncate">{hasSelection ? `已选 ${count} 条` : "选择本页"}</span>
        </label>
        {hasSelection ? (
          <button className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" type="button" onClick={onClear} aria-label="清空选择">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={!hasSelection || busy || !canAssignToMe} onClick={onAssignToMe}>
          <UserCheck className="h-4 w-4" />
          批量接手
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={!hasSelection || busy || !canGenerateReply} onClick={onGenerateReplies}>
          <Sparkles className="h-4 w-4" />
          生成回复
        </Button>
        <div className="col-span-2">
          <Select value="" disabled={!hasSelection || busy || allowedStatuses.length === 0} onChange={(value) => value && onStatusChange(value as SupportTicketStatus)}>
          <option value="">{busy ? "处理中..." : allowedStatuses.length === 0 && hasSelection ? "无可流转" : "批量状态"}</option>
          {statusOptions
            .filter((item): item is SupportTicketStatus => item !== "" && allowedStatuses.includes(item))
            .map((item) => (
              <option key={item} value={item} disabled={!hasSelection || busy}>
                {statusLabels[item]}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </div>
  );
}

function QueueStats({
  stats,
  status,
  overdueOnly,
  onStatusChange,
  onOverdueOnlyChange
}: {
  stats: TicketQueueStats;
  status: SupportTicketStatus | "";
  overdueOnly: boolean;
  onStatusChange: (value: SupportTicketStatus | "") => void;
  onOverdueOnlyChange: (value: boolean) => void;
}) {
  const items: Array<{ label: string; value: number; active: boolean; onClick: () => void }> = [
    { label: "待处理", value: stats.open, active: status === "OPEN", onClick: () => onStatusChange(status === "OPEN" ? "" : "OPEN") },
    { label: "处理中", value: stats.inProgress, active: status === "IN_PROGRESS", onClick: () => onStatusChange(status === "IN_PROGRESS" ? "" : "IN_PROGRESS") },
    { label: "待客户", value: stats.waitingCustomer, active: status === "WAITING_CUSTOMER", onClick: () => onStatusChange(status === "WAITING_CUSTOMER" ? "" : "WAITING_CUSTOMER") },
    { label: "逾期", value: stats.overdue, active: overdueOnly, onClick: () => onOverdueOnlyChange(!overdueOnly) }
  ];

  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className={cn(
            "min-w-0 rounded-md border px-2 py-2 text-left transition",
            item.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          )}
          onClick={item.onClick}
        >
          <span className="block truncate text-[11px]">{item.label}</span>
          <span className="mt-0.5 block text-sm font-semibold">{stats.loading ? "-" : item.value}</span>
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-md px-2 transition hover:bg-white">
      <input className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function TicketListItem({
  ticket,
  active,
  selected,
  onSelectedChange,
  onOpen
}: {
  ticket: SupportTicketResponse;
  active: boolean;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <div className={cn("flex w-full items-start gap-3 p-4 transition hover:bg-slate-50", active && "bg-emerald-50/70 hover:bg-emerald-50")}>
      <label className="mt-0.5 grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md border border-slate-200 bg-white text-slate-400 transition hover:border-emerald-200 hover:text-emerald-600">
        <input
          className="sr-only"
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
          aria-label={`选择工单 ${ticket.ticketNo}`}
        />
        {selected ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />}
      </label>
      <button className="min-w-0 flex-1 text-left" type="button" onClick={onOpen}>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="truncate text-xs font-medium text-slate-500">{ticket.ticketNo}</span>
          <div className="flex shrink-0 items-center gap-2">
            <PriorityIcon priority={ticket.priority} />
            <StatusDot status={ticket.status} />
          </div>
        </div>
        <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-950">{ticket.issueSummary}</p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          <span className="truncate">{ticket.customerName}</span>
          <span>{ticket.category}</span>
          <SlaBadge ticket={ticket} compact />
        </div>
        <p className="mt-1 truncate text-xs text-slate-400">负责人：{ticket.assigneeName || "未分配"}</p>
      </button>
    </div>
  );
}

