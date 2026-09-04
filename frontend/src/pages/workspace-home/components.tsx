import { ArrowRight, BookOpen, ClipboardList, Headphones, ShieldCheck, Sparkles } from "lucide-react";
import { ReactNode } from "react";
import { Badge, Button, EmptyState, Panel, PanelHeader } from "../../components/ui";
import { formatDateTime, shortId } from "../../lib/utils";
import type { AuditLogResponse, KnowledgeBaseResponse } from "../../types";
import { auditActionLabel, auditTargetLabel } from "../admin/audit-labels";

export function ServiceOverview({
  ticketTotal,
  openTickets,
  inProgressTickets,
  overdueTickets,
  loadingTickets,
  knowledgeBases,
  loadingKnowledgeBases,
  isAdmin,
  onOpenTickets,
  onOpenKnowledgeBases,
  onOpenAdmin
}: {
  ticketTotal: number;
  openTickets: number;
  inProgressTickets: number;
  overdueTickets: number;
  loadingTickets: boolean;
  knowledgeBases: KnowledgeBaseResponse[];
  loadingKnowledgeBases: boolean;
  isAdmin: boolean;
  onOpenTickets: () => void;
  onOpenKnowledgeBases: () => void;
  onOpenAdmin: () => void;
}) {
  const manageableCount = knowledgeBases.filter((kb) => kb.manageable).length;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,0.8fr)]">
      <Panel className="overflow-hidden">
        <PanelHeader
          title="今日处理"
          description="优先处理逾期和待处理工单；知识库作为回复依据放在支撑区。"
          actions={
            <Button size="sm" onClick={onOpenTickets}>
              <Headphones className="h-4 w-4" />
              进入工单
            </Button>
          }
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricBlock label="全部工单" value={loadingTickets ? "-" : ticketTotal} tone="slate" />
          <MetricBlock label="待处理" value={loadingTickets ? "-" : openTickets} tone={openTickets > 0 ? "amber" : "slate"} />
          <MetricBlock label="处理中" value={loadingTickets ? "-" : inProgressTickets} tone="cyan" />
          <MetricBlock label="已逾期" value={loadingTickets ? "-" : overdueTickets} tone={overdueTickets > 0 ? "rose" : "slate"} />
        </div>
      </Panel>

      <div className="grid gap-4">
        <ServiceEntry
          icon={<BookOpen className="h-5 w-5" />}
          title="知识库运营"
          description="维护资料、调试检索、处理知识缺口。"
          meta={loadingKnowledgeBases ? "加载中" : `${knowledgeBases.length} 个知识库，${manageableCount} 个可维护`}
          onClick={onOpenKnowledgeBases}
        />
        {isAdmin ? (
          <ServiceEntry
            icon={<ShieldCheck className="h-5 w-5" />}
            title="系统管理"
            description="用户、租户和审计日志集中在管理区。"
            meta="管理员可见"
            onClick={onOpenAdmin}
          />
        ) : (
          <Panel className="p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">坐席视图</p>
                <p className="mt-1 text-sm text-slate-500">系统管理入口仅管理员可见。</p>
              </div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

export function KnowledgeSnapshot({
  knowledgeBases,
  loading,
  onOpenKnowledgeBase,
  onOpenDirectory
}: {
  knowledgeBases: KnowledgeBaseResponse[];
  loading: boolean;
  onOpenKnowledgeBase: (id: string) => void;
  onOpenDirectory: () => void;
}) {
  const visible = knowledgeBases.slice(0, 4);

  return (
    <Panel>
      <PanelHeader
        title="知识库状态"
        description="常用知识库放在这里，具体文档、成员和任务进入详情页。"
        actions={
          <Button size="sm" variant="secondary" onClick={onOpenDirectory}>
            查看全部
          </Button>
        }
      />
      <div className="space-y-2 p-4 sm:p-5">
        {loading ? <p className="text-sm text-slate-500">正在加载知识库...</p> : null}
        {!loading && visible.length === 0 ? <EmptyState title="暂无知识库" description="创建或获得授权后，知识库会显示在这里。" /> : null}
        {visible.map((kb) => (
          <button
            key={kb.id}
            type="button"
            className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50/30"
            onClick={() => onOpenKnowledgeBase(kb.id)}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-950">{kb.name}</p>
                <Badge tone={kb.manageable ? "green" : "slate"}>{kb.manageable ? "可维护" : "已授权"}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">召回 {kb.topK} · 切片 {kb.chunkSize} · 阈值 {kb.minScore}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
          </button>
        ))}
      </div>
    </Panel>
  );
}

export function AdminSnapshot({
  logs,
  loading,
  isAdmin,
  onOpenAuditLogs
}: {
  logs: AuditLogResponse[];
  loading: boolean;
  isAdmin: boolean;
  onOpenAuditLogs: () => void;
}) {
  if (!isAdmin) {
    return null;
  }

  return (
    <Panel>
      <PanelHeader
        title="最近管理动作"
        description="用于快速发现权限、租户和知识库配置变更。"
        actions={
          <Button size="sm" variant="secondary" onClick={onOpenAuditLogs}>
            审计日志
          </Button>
        }
      />
      <div className="space-y-2 p-4 sm:p-5">
        {loading ? <p className="text-sm text-slate-500">正在加载审计日志...</p> : null}
        {!loading && logs.length === 0 ? <EmptyState title="暂无管理动作" description="关键管理操作会显示在这里。" /> : null}
        {logs.slice(0, 5).map((log) => (
          <div key={log.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <ClipboardList className="h-4 w-4 text-cyan-700" />
              <p className="text-sm font-medium text-slate-950">{auditActionLabel(log.action)}</p>
              {log.targetType ? <Badge tone="cyan">{auditTargetLabel(log.targetType)}</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{log.detail || "无详情"}</p>
            <p className="mt-1 text-xs text-slate-400">
              {formatDateTime(log.createdAt)} · {log.userId ? shortId(log.userId) : "-"}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ServiceEntry({
  icon,
  title,
  description,
  meta,
  onClick
}: {
  icon: ReactNode;
  title: string;
  description: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="group flex min-w-0 items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-900/5 transition hover:border-emerald-200 hover:bg-emerald-50/30"
      onClick={onClick}
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-emerald-100 group-hover:text-emerald-700">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-700" />
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        <p className="mt-3 text-xs font-medium text-slate-400">{meta}</p>
      </div>
    </button>
  );
}

function MetricBlock({
  label,
  value,
  tone
}: {
  label: string;
  value: number | string;
  tone: "slate" | "amber" | "cyan" | "rose";
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800"
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}
