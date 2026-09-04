import { AlertTriangle, ArrowUpCircle, Circle, Clock3 } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "../../components/ui";
import { cn } from "../../lib/utils";
import type { SupportTicketPriority, SupportTicketResponse, SupportTicketStatus } from "../../types";
import { priorityLabels, statusLabels } from "./constants";
export function Select({
  value,
  onChange,
  children,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <select
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

export function StatusDot({ status }: { status: SupportTicketStatus }) {
  const color = status === "OPEN" ? "bg-amber-500" : status === "IN_PROGRESS" ? "bg-cyan-500" : "bg-emerald-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {statusLabels[status]}
    </span>
  );
}

export function StatusBadge({ value }: { value: SupportTicketStatus }) {
  const tone = value === "RESOLVED" || value === "CLOSED" ? "green" : value === "OPEN" ? "amber" : "cyan";
  return <Badge tone={tone}>{statusLabels[value]}</Badge>;
}

export function PriorityBadge({ value }: { value: SupportTicketPriority }) {
  const tone = value === "URGENT" ? "rose" : value === "HIGH" ? "amber" : value === "NORMAL" ? "slate" : "green";
  return (
    <Badge tone={tone}>
      <span className="inline-flex items-center gap-1">
        <PriorityIcon priority={value} />
        {priorityLabels[value]}
      </span>
    </Badge>
  );
}

export function PriorityIcon({ priority }: { priority: SupportTicketPriority }) {
  if (priority === "URGENT") {
    return <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />;
  }
  if (priority === "HIGH") {
    return <ArrowUpCircle className="h-3.5 w-3.5 text-amber-600" />;
  }
  if (priority === "LOW") {
    return <Circle className="h-3.5 w-3.5 text-emerald-600" />;
  }
  return <Circle className="h-3.5 w-3.5 text-slate-500" />;
}

export function SlaBadge({ ticket, compact = false }: { ticket: SupportTicketResponse; compact?: boolean }) {
  const tone = ticket.overdue ? "rose" : ticket.dueSoon ? "amber" : "slate";
  const label = ticket.overdue ? "已逾期" : ticket.dueSoon ? "临近 SLA" : compact ? "SLA" : "SLA 正常";
  return (
    <Badge tone={tone}>
      <span className="inline-flex items-center gap-1">
        <Clock3 className="h-3.5 w-3.5" />
        {label}
      </span>
    </Badge>
  );
}

export function InfoTile({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 min-w-0 break-words text-sm font-medium text-slate-900">{value}</p>
      {subValue ? <p className="mt-1 text-xs text-slate-500">{subValue}</p> : null}
    </div>
  );
}

export function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-slate-700">{value}</dd>
    </div>
  );
}

