import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, EmptyState, ErrorMessage, Input, PageHeader, Pagination, Panel, PanelHeader } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime, shortId } from "../lib/utils";

const PAGE_SIZE = 12;

const actionLabels: Record<string, string> = {
  TENANT_CREATE: "创建租户",
  USER_ROLE_UPDATE: "调整用户角色",
  KNOWLEDGE_BASE_CREATE: "创建知识库",
  KNOWLEDGE_BASE_UPDATE: "更新知识库",
  KNOWLEDGE_BASE_DELETE: "删除知识库",
  KNOWLEDGE_BASE_MEMBER_SAVE: "保存成员授权",
  KNOWLEDGE_BASE_MEMBER_REMOVE: "移除成员授权",
  KNOWLEDGE_BASE_INDEX_REBUILD: "重建索引",
  DOCUMENT_UPLOAD: "上传文档",
  DOCUMENT_REINGEST: "文档重入库",
  DOCUMENT_DELETE: "删除文档"
};

/**
 * 审计日志页。
 *
 * <p>这里只展示关键管理动作，帮助管理员追踪“谁在什么时候改了什么”。问答消息本身不作为审计日志展示，
 * 避免把普通用户的业务提问混入管理审计。</p>
 */
export default function AuditLogsPage() {
  const [keyword, setKeyword] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);

  const logsQuery = useQuery({
    queryKey: ["admin-audit-logs", page, PAGE_SIZE, keyword, action],
    queryFn: () => api.listAuditLogsPage({ page, pageSize: PAGE_SIZE, keyword, action })
  });

  const logs = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;
  const totalPages = logsQuery.data?.totalPages ?? 1;
  const safePage = logsQuery.data?.page ?? page;

  useEffect(() => {
    setPage(1);
  }, [keyword, action]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-7xl min-w-0 max-w-full p-4 lg:p-8">
      <PageHeader
        eyebrow="平台管理"
        title="审计日志"
        description="记录关键管理动作，用于追踪知识库、成员、文档、租户和用户角色变更。"
      />

      <Panel>
        <PanelHeader
          title="操作记录"
          description="按时间倒序展示。日志用于排查问题，不建议作为普通业务数据编辑入口。"
          actions={<Badge tone="slate">{total} 条记录</Badge>}
        />
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索动作、对象、用户编号或详情"
              />
            </div>
            <select
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="">全部动作</option>
              {Object.entries(actionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2 p-5">
          <ErrorMessage error={logsQuery.error} />
          {logsQuery.isLoading ? <p className="text-sm text-slate-500">正在加载审计日志...</p> : null}
          {total === 0 && !keyword && !action ? <EmptyState title="暂无审计记录" description="执行创建知识库、授权成员、上传文档等操作后会显示在这里。" /> : null}
          {total === 0 && (keyword || action) ? <EmptyState title="没有匹配记录" description="可以更换搜索条件，或选择全部动作。" /> : null}
          {logs.map((log) => (
            <article key={log.id} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">{actionLabels[log.action] ?? log.action}</h2>
                    <Badge tone="cyan">{log.targetType ?? "UNKNOWN"}</Badge>
                    {log.targetId ? <Badge tone="slate">{shortId(log.targetId)}</Badge> : null}
                  </div>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">{log.detail || "无详情"}</p>
                  <p className="mt-1 break-all text-xs text-slate-400">
                    用户 {log.userId ? shortId(log.userId) : "-"} · 租户 {log.tenantId ? shortId(log.tenantId) : "-"} · 日志 {shortId(log.id)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-500 lg:text-right">{formatDateTime(log.createdAt)}</p>
            </article>
          ))}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Panel>
    </div>
  );
}
