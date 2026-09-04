import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, EmptyState, ErrorMessage, PageHeader, Pagination, Panel, PanelHeader } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime, shortId } from "../lib/utils";
import { auditActionLabel, auditActionLabels, auditTargetLabel } from "./admin/audit-labels";
import { AdminPageLayout, EntityAvatar, FilterBar, RecordCard, RecordList, SearchField, SelectField } from "./admin/components";

const PAGE_SIZE = 12;

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
    <AdminPageLayout>
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
        <FilterBar>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
            <SearchField value={keyword} onChange={setKeyword} placeholder="搜索动作、对象、用户编号或详情" />
            <SelectField value={action} onChange={setAction}>
              <option value="">全部动作</option>
              {Object.entries(auditActionLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </SelectField>
          </div>
        </FilterBar>

        <RecordList
          loading={logsQuery.isLoading}
          loadingText="正在加载审计日志..."
          empty={
            <>
              {total === 0 && !keyword && !action ? <EmptyState title="暂无审计记录" description="执行创建知识库、授权成员、上传文档等操作后会显示在这里。" /> : null}
              {total === 0 && (keyword || action) ? <EmptyState title="没有匹配记录" description="可以更换搜索条件，或选择全部动作。" /> : null}
            </>
          }
        >
          <ErrorMessage error={logsQuery.error} />
          {logs.map((log) => (
            <RecordCard key={log.id} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <EntityAvatar tone="cyan">
                  <ClipboardList className="h-5 w-5" />
                </EntityAvatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-950">{auditActionLabel(log.action)}</h2>
                    <Badge tone="cyan">{auditTargetLabel(log.targetType)}</Badge>
                    {log.targetId ? <Badge tone="slate">{shortId(log.targetId)}</Badge> : null}
                  </div>
                  <p className="mt-1 break-words text-sm leading-6 text-slate-600">{log.detail || "无详情"}</p>
                  <p className="mt-1 break-all text-xs text-slate-400">
                    用户 {log.userId ? shortId(log.userId) : "-"} · 租户 {log.tenantId ? shortId(log.tenantId) : "-"} · 日志 {shortId(log.id)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-500 lg:text-right">{formatDateTime(log.createdAt)}</p>
            </RecordCard>
          ))}
        </RecordList>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Panel>
    </AdminPageLayout>
  );
}
