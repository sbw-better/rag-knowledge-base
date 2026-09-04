import { Search } from "lucide-react";
import { ReactNode } from "react";
import { EmptyState, Input, Panel } from "../../components/ui";
import { cn } from "../../lib/utils";

export function AdminPageLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[100rem] min-w-0 p-4 lg:p-6">{children}</div>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">{children}</div>;
}

export function SearchField({
  value,
  placeholder,
  className,
  onChange
}: {
  value: string;
  placeholder: string;
  className?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input className="pl-9" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

export function SelectField({
  value,
  children,
  onChange
}: {
  value: string;
  children: ReactNode;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

export function RecordList({
  children,
  loading,
  loadingText,
  empty,
  className
}: {
  children: ReactNode;
  loading: boolean;
  loadingText: string;
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2 p-4 sm:p-5", className)}>
      {loading ? <p className="text-sm text-slate-500">{loadingText}</p> : null}
      {!loading ? empty : null}
      {children}
    </div>
  );
}

export function RecordCard({ children, className }: { children: ReactNode; className?: string }) {
  return <article className={cn("min-w-0 rounded-lg border border-slate-200 bg-white p-4", className)}>{children}</article>;
}

export function EntityAvatar({
  children,
  tone = "slate"
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "cyan";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    cyan: "bg-cyan-50 text-cyan-700"
  };

  return <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tones[tone])}>{children}</div>;
}

export function MetricTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function HintPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <Panel className={cn("border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800", className)}>{children}</Panel>;
}

export function EmptySearchState({ active, title, description }: { active: boolean; title: string; description: string }) {
  return active ? <EmptyState title={title} description={description} /> : null;
}
