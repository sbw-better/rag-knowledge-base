import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Users } from "lucide-react";
import { FormEvent, useState } from "react";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, PageHeader, Panel, PanelHeader } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";

/**
 * 租户管理页。
 *
 * 第一版只提供租户创建和查看，不提供删除、用户迁移和租户切换。这样可以先把租户边界
 * 在产品界面中显式展示出来，同时避免误操作影响已有用户和知识库数据。
 */
export default function TenantsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const tenantsQuery = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: api.listTenants
  });

  const createMutation = useMutation({
    mutationFn: () => api.createTenant({ name }),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    createMutation.mutate();
  }

  const tenants = tenantsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl min-w-0 max-w-full p-4 lg:p-8">
      <PageHeader
        eyebrow="平台管理"
        title="租户管理"
        description="租户用于隔离不同组织的数据。当前注册用户仍进入默认租户，后续会扩展邀请用户加入指定租户。"
      />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Panel className="h-fit">
          <PanelHeader title="创建租户" description="先创建组织边界，再在后续版本中分配用户和配置资源。" />
          <form className="space-y-4 p-5" onSubmit={submit}>
            <ErrorMessage error={createMutation.error} />
            <Field label="租户名称">
              <Input value={name} maxLength={120} placeholder="例如：华东业务部" onChange={(event) => setName(event.target.value)} />
            </Field>
            <Button className="w-full" type="submit" disabled={!name.trim() || createMutation.isPending}>
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? "创建中..." : "创建租户"}
            </Button>
          </form>
        </Panel>

        <Panel>
          <PanelHeader title="租户列表" description="查看当前平台内已创建的租户及基础规模。" actions={<Badge tone="slate">{tenants.length} 个租户</Badge>} />
          <div className="space-y-3 p-5">
            <ErrorMessage error={tenantsQuery.error} />
            {tenantsQuery.isLoading ? <p className="text-sm text-slate-500">正在加载租户...</p> : null}
            {!tenantsQuery.isLoading && tenants.length === 0 ? <EmptyState title="暂无租户" description="创建第一个租户后，会显示在这里。" /> : null}
            {tenants.map((tenant) => (
              <article key={tenant.id} className="grid min-w-0 gap-4 rounded-lg border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-slate-950">{tenant.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">创建于 {formatDateTime(tenant.createdAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:min-w-72">
                  <Metric label="用户" value={tenant.userCount} />
                  <Metric label="知识库" value={tenant.knowledgeBaseCount} />
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 rounded-lg border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800">
        <div className="flex gap-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0" />
          <p>当前版本先完成租户可视化和创建能力；用户加入指定租户、跨租户迁移、租户级模型配置会作为后续升级单独实现。</p>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
    </div>
  );
}
