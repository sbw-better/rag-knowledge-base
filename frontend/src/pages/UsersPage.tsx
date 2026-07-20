import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Shield, UserCog, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, EmptyState, ErrorMessage, Input, PageHeader, Pagination, Panel, PanelHeader } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";
import type { AdminUserResponse } from "../types";

const PAGE_SIZE = 8;

const optionalRoles = [
  { id: "KB_MANAGER", label: "知识库管理员", description: "可创建知识库，并自动成为该知识库的负责人。" },
  { id: "ADMIN", label: "平台管理员", description: "拥有平台级管理权限，请谨慎授予。" }
];

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const usersQuery = useQuery({
    queryKey: ["admin-users-page", page, PAGE_SIZE, keyword],
    queryFn: () => api.listAdminUsersPage({ page, pageSize: PAGE_SIZE, keyword })
  });
  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = usersQuery.data?.totalPages ?? 1;
  const safePage = usersQuery.data?.page ?? page;

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const roleMutation = useMutation({
    mutationFn: ({ user, roles }: { user: AdminUserResponse; roles: string[] }) => api.updateUserRoles(user.id, { roles }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users-page"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    }
  });

  function toggleRole(user: AdminUserResponse, role: string) {
    const roleSet = new Set(user.roles);
    if (roleSet.has(role)) {
      roleSet.delete(role);
    } else {
      roleSet.add(role);
    }
    roleSet.add("USER");
    roleMutation.mutate({ user, roles: Array.from(roleSet) });
  }

  return (
    <div className="mx-auto max-w-7xl min-w-0 max-w-full p-4 lg:p-8">
      <PageHeader
        eyebrow="平台管理"
        title="用户管理"
        description="为用户分配系统角色。普通用户只能使用被授权的知识库；知识库管理员可以创建并维护自己负责的知识库。"
      />

      <Panel>
        <PanelHeader
          title="用户角色"
          description="只在这里分配平台级角色。知识库负责人由创建知识库自动产生，知识库成员在具体知识库里授权。"
          actions={<Badge tone="slate">用户 {total}</Badge>}
        />
        <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <RoleNote title="USER" description="基础角色，注册后默认拥有。" tone="slate" />
            <RoleNote title="KB_MANAGER" description="可以创建知识库，并维护自己负责的知识库。" tone="cyan" />
            <RoleNote title="ADMIN" description="拥有平台级管理权限，请谨慎授予。" tone="rose" />
          </div>
          {(total > 0 || keyword) ? (
            <div className="relative mt-4 max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索用户名、邮箱或角色"
              />
            </div>
          ) : null}
        </div>
        <div className="space-y-2 p-5">
          <ErrorMessage error={usersQuery.error || roleMutation.error} />
          {usersQuery.isLoading ? <p className="text-sm text-slate-500">正在加载用户...</p> : null}
          {total === 0 && !keyword ? <EmptyState title="暂无用户" description="用户注册后会显示在这里。" /> : null}
          {total === 0 && keyword ? <EmptyState title="没有匹配用户" description="可以更换搜索关键词，或清空搜索条件。" /> : null}
          {users.map((user) => (
            <article key={user.id} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                    {(user.displayName || user.email || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-slate-950">{user.displayName}</h2>
                      {user.roles.map((role) => (
                        <Badge key={role} tone={role === "ADMIN" ? "rose" : role === "KB_MANAGER" ? "cyan" : "slate"}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">注册于 {formatDateTime(user.createdAt)}</p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {optionalRoles.map((role) => {
                    const checked = user.roles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        className={checked
                          ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-left transition hover:border-emerald-300"
                          : "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50"}
                        disabled={roleMutation.isPending}
                        onClick={() => toggleRole(user, role.id)}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {role.id === "ADMIN" ? <Shield className="h-4 w-4 text-rose-500" /> : <UserCog className="h-4 w-4 text-cyan-600" />}
                          <span className="truncate text-sm font-medium text-slate-900">{role.label}</span>
                          <span className={checked ? "ml-auto shrink-0 text-xs text-emerald-700" : "ml-auto shrink-0 text-xs text-slate-400"}>{checked ? "已启用" : "未启用"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </Panel>
    </div>
  );
}

function RoleNote({ title, description, tone }: { title: string; description: string; tone: "slate" | "cyan" | "rose" }) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="mt-0.5">
        {title === "ADMIN" ? <Shield className="h-4 w-4 text-rose-500" /> : title === "KB_MANAGER" ? <UserCog className="h-4 w-4 text-cyan-600" /> : <Users className="h-4 w-4 text-slate-500" />}
      </div>
      <div className="min-w-0">
        <Badge tone={tone}>{title}</Badge>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
