import { AlertCircle, ArrowRight, BarChart3, BookOpen, ClipboardList, Headphones, MessageSquareText, ShieldCheck, Sparkles, Timer, TrendingUp, UsersRound } from "lucide-react";
import { ReactNode } from "react";
import { Badge, Button, EmptyState, Panel, PanelHeader } from "../../components/ui";
import { formatDateTime, shortId } from "../../lib/utils";
import type { AuditLogResponse, KnowledgeBaseResponse, SupportTicketStatsBucketResponse, SupportTicketStatsResponse } from "../../types";
import { auditActionLabel, auditTargetLabel } from "../admin/audit-labels";

const priorityNames: Record<string, string> = {
  URGENT: "紧急",
  HIGH: "高",
  NORMAL: "普通",
  LOW: "低"
};

const statsWindowOptions = [
  { label: "今日", value: 1 },
  { label: "近 7 天", value: 7 },
  { label: "近 30 天", value: 30 }
];

export function ServiceOverview({
  ticketTotal,
  openTickets,
  inProgressTickets,
  overdueTickets,
  loadingTickets,
  knowledgeBases,
  loadingKnowledgeBases,
  canViewSupport,
  canViewKnowledge,
  canViewAdmin,
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
  canViewSupport: boolean;
  canViewKnowledge: boolean;
  canViewAdmin: boolean;
  onOpenTickets: () => void;
  onOpenKnowledgeBases: () => void;
  onOpenAdmin: () => void;
}) {
  const manageableCount = knowledgeBases.filter((kb) => kb.manageable).length;
  const sideEntries = (
    <div className="grid gap-4">
      {canViewKnowledge ? (
        <ServiceEntry
          icon={<BookOpen className="h-5 w-5" />}
          title="知识库运营"
          description="维护资料、调试检索、处理知识缺口。"
          meta={loadingKnowledgeBases ? "加载中" : `${knowledgeBases.length} 个知识库，${manageableCount} 个可维护`}
          onClick={onOpenKnowledgeBases}
        />
      ) : null}
      {canViewAdmin ? (
        <ServiceEntry
          icon={<ShieldCheck className="h-5 w-5" />}
          title="系统管理"
          description="用户、租户和审计日志集中在管理区。"
          meta="管理员可见"
          onClick={onOpenAdmin}
        />
      ) : null}
      {!canViewSupport && !canViewKnowledge && !canViewAdmin ? (
        <Panel className="p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">等待授权</p>
              <p className="mt-1 text-sm text-slate-500">获得知识库或工单处理权限后，这里会显示对应入口。</p>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );

  if (!canViewSupport) {
    return sideEntries;
  }

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

      {sideEntries}
    </div>
  );
}

export function SupportOperationsDashboard({
  stats,
  loading,
  windowDays,
  onWindowDaysChange,
  onOpenTickets
}: {
  stats?: SupportTicketStatsResponse;
  loading: boolean;
  windowDays: number;
  onWindowDaysChange: (days: number) => void;
  onOpenTickets: () => void;
}) {
  const knowledgeHitRate = stats?.knowledgeHitRate == null ? "-" : `${stats.knowledgeHitRate}%`;
  const avgFirstResponse = loading ? "-" : formatMinutes(stats?.avgFirstResponseMinutes);
  const slaRate = stats?.slaAttainmentRate == null ? "-" : `${stats.slaAttainmentRate}%`;
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="售后运营看板"
        description={`按${windowDays === 1 ? "今日" : `近 ${windowDays} 天`}观察回复效率、知识缺口、SLA 和坐席负载。`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
              {statsWindowOptions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`h-8 rounded-md px-3 text-xs font-medium transition ${
                    windowDays === item.value ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                  onClick={() => onWindowDaysChange(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={onOpenTickets}>
              <BarChart3 className="h-4 w-4" />
              查看队列
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricBlock label="窗口工单" value={loading ? "-" : stats?.total ?? 0} tone="slate" note={formatDelta(stats?.totalChange)} />
          <MetricBlock label="已解决/关闭" value={loading ? "-" : (stats?.resolved ?? 0) + (stats?.closed ?? 0)} tone="green" note={formatDelta(stats?.resolvedChange)} />
          <MetricBlock label="平均首响" value={avgFirstResponse} tone="cyan" note="首次外发" />
          <MetricBlock label="SLA 达成率" value={loading ? "-" : slaRate} tone={(stats?.slaAttainmentRate ?? 100) < 80 ? "amber" : "green"} note="按解决工单" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricBlock label="AI 辅助回复" value={loading ? "-" : stats?.aiReplyGenerated ?? 0} tone="cyan" />
          <MetricBlock label="知识命中率" value={loading ? "-" : knowledgeHitRate} tone="green" />
          <MetricBlock label="待补知识" value={loading ? "-" : stats?.openKnowledgeIssues ?? 0} tone={(stats?.openKnowledgeIssues ?? 0) > 0 ? "amber" : "slate"} />
          <MetricBlock label="客服外发" value={loading ? "-" : stats?.outgoingReplies ?? 0} tone="slate" note={formatDelta(stats?.outgoingRepliesChange)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)]">
          <TrendPanel stats={stats} loading={loading} />
          <AgentStatsPanel stats={stats} loading={loading} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(20rem,0.9fr)_minmax(0,1.1fr)]">
          <NoAnswerRank stats={stats} loading={loading} />
          <div className="grid gap-4 lg:grid-cols-3">
          <DistributionPanel title="问题分类" items={stats?.categoryDistribution ?? []} loading={loading} color="emerald" />
          <DistributionPanel title="来源渠道" items={stats?.channelDistribution ?? []} loading={loading} color="cyan" />
          <DistributionPanel title="优先级" items={(stats?.priorityDistribution ?? []).map((item) => ({ ...item, name: priorityNames[item.name] ?? item.name }))} loading={loading} color="amber" />
          </div>
        </div>
      </div>
    </Panel>
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

function NoAnswerRank({ stats, loading }: { stats?: SupportTicketStatsResponse; loading: boolean }) {
  const items = stats?.noAnswerQuestions ?? [];
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          无答案排行
        </h3>
        <Badge tone={(stats?.noContextIssues ?? 0) > 0 ? "amber" : "slate"}>{loading ? "-" : `${stats?.noContextIssues ?? 0} 条`}</Badge>
      </div>
      {loading ? <p className="text-sm text-slate-500">正在加载排行...</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">暂无售后知识缺口。</p> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={`${item.question}-${item.latestAt}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="line-clamp-2 text-sm font-medium leading-5 text-slate-900">{item.question}</p>
              <Badge tone="amber">{item.total}</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-400">{formatDateTime(item.latestAt)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrendPanel({ stats, loading }: { stats?: SupportTicketStatsResponse; loading: boolean }) {
  const items = stats?.trend ?? [];
  const max = Math.max(1, ...items.flatMap((item) => [item.total, item.resolved, item.outgoingReplies]));
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <TrendingUp className="h-4 w-4 text-emerald-700" />
          趋势对比
        </h3>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          <Legend color="bg-slate-400" label="新增" />
          <Legend color="bg-emerald-500" label="解决" />
          <Legend color="bg-cyan-500" label="外发" />
        </div>
      </div>
      {loading ? <p className="text-sm text-slate-500">正在加载趋势...</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">暂无趋势数据。</p> : null}
      <div className="flex min-h-44 items-end gap-2 overflow-x-auto pb-1">
        {items.map((item) => (
          <div key={item.dateLabel} className="flex min-w-10 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end justify-center gap-1 rounded-md bg-slate-50 px-1 py-2">
              <TrendBar value={item.total} max={max} color="bg-slate-400" />
              <TrendBar value={item.resolved} max={max} color="bg-emerald-500" />
              <TrendBar value={item.outgoingReplies} max={max} color="bg-cyan-500" />
            </div>
            <span className="text-[11px] text-slate-400">{item.dateLabel}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentStatsPanel({ stats, loading }: { stats?: SupportTicketStatsResponse; loading: boolean }) {
  const items = stats?.agentStats ?? [];
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950">
          <UsersRound className="h-4 w-4 text-cyan-700" />
          坐席维度
        </h3>
        <Badge tone="slate">{loading ? "-" : `${items.length} 人`}</Badge>
      </div>
      {loading ? <p className="text-sm text-slate-500">正在加载坐席数据...</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">暂无坐席数据。</p> : null}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.assigneeId ?? "unassigned"} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{item.assigneeName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  负责 {item.assignedTickets} · 未完结 {item.openTickets} · 已解决 {item.resolvedTickets}
                </p>
              </div>
              <Badge tone={item.slaAttainmentRate == null || item.slaAttainmentRate >= 80 ? "green" : "amber"}>
                SLA {item.slaAttainmentRate == null ? "-" : `${item.slaAttainmentRate}%`}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MiniMetric icon={<Timer className="h-3.5 w-3.5" />} label="首响" value={formatMinutes(item.avgFirstResponseMinutes)} />
              <MiniMetric icon={<MessageSquareText className="h-3.5 w-3.5" />} label="外发" value={item.outgoingReplies} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DistributionPanel({
  title,
  items,
  loading,
  color
}: {
  title: string;
  items: SupportTicketStatsBucketResponse[];
  loading: boolean;
  color: "emerald" | "cyan" | "amber";
}) {
  const max = Math.max(1, ...items.map((item) => item.total));
  const barColor = {
    emerald: "bg-emerald-500",
    cyan: "bg-cyan-500",
    amber: "bg-amber-500"
  }[color];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
        <MessageSquareText className="h-4 w-4 text-cyan-700" />
        {title}
      </h3>
      {loading ? <p className="text-sm text-slate-500">正在加载分布...</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">暂无数据。</p> : null}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium text-slate-600">{item.name}</span>
              <span className="shrink-0 text-slate-400">{item.total}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.max(8, (item.total / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricBlock({
  label,
  value,
  tone,
  note
}: {
  label: string;
  value: number | string;
  tone: "slate" | "amber" | "cyan" | "rose" | "green";
  note?: string;
}) {
  const tones = {
    slate: "border-slate-200 bg-slate-50 text-slate-950",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    cyan: "border-cyan-200 bg-cyan-50 text-cyan-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800"
  };

  return (
    <div className={`rounded-lg border px-4 py-3 ${tones[tone]}`}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-xs text-slate-500">{label}</p>
        {note ? <span className="shrink-0 text-[11px] text-slate-400">{note}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function TrendBar({ value, max, color }: { value: number; max: number; color: string }) {
  return <span className={`w-2 rounded-full ${color}`} style={{ height: `${Math.max(8, (value / max) * 112)}px` }} title={`${value}`} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-slate-600">
      <p className="flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function formatDelta(value?: number) {
  if (value == null) {
    return "-";
  }
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function formatMinutes(value?: number | null) {
  if (value == null) {
    return "-";
  }
  if (value < 60) {
    return `${value} 分`;
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${hours} 时 ${minutes} 分` : `${hours} 时`;
}
