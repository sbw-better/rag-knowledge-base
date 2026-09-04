import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Label, Panel, PanelHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { cn } from "../../lib/utils";
import type { KnowledgeBaseMemberRequest } from "../../types";
import { errorText } from "./shared";

export function MembersPanel({ kbId }: { kbId: string }) {
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberUserIds, setSelectedMemberUserIds] = useState<string[]>([]);
  const [memberPermission, setMemberPermission] = useState<KnowledgeBaseMemberRequest["permission"]>("VIEWER");
  const [grantResult, setGrantResult] = useState<{ total: number; failed: Array<{ userId: string; label: string; error: string }> } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["knowledge-base-member-candidates", kbId],
    queryFn: () => api.listKnowledgeBaseMemberCandidates(kbId)
  });

  const membersQuery = useQuery({
    queryKey: ["knowledge-base-members", kbId],
    queryFn: () => api.listKnowledgeBaseMembers(kbId)
  });

  const users = usersQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const memberUserIds = new Set(members.map((member) => member.userId));
  const availableUsers = users.filter((user) => user.enabled && !user.roles.includes("ADMIN") && !memberUserIds.has(user.id));
  const normalizedSearch = memberSearch.trim().toLowerCase();
  const filteredAvailableUsers = normalizedSearch
    ? availableUsers.filter((user) => `${user.displayName} ${user.email}`.toLowerCase().includes(normalizedSearch))
    : availableUsers;
  const visibleSelectedCount = filteredAvailableUsers.filter((user) => selectedMemberUserIds.includes(user.id)).length;
  const allVisibleSelected = filteredAvailableUsers.length > 0 && visibleSelectedCount === filteredAvailableUsers.length;

  const saveMembersMutation = useMutation({
    mutationFn: async () => {
      const targets = [...selectedMemberUserIds];
      const failed: Array<{ userId: string; label: string; error: string }> = [];
      await Promise.all(
        targets.map(async (userId) => {
          const targetUser = users.find((user) => user.id === userId);
          try {
            await api.saveKnowledgeBaseMember(kbId, { userId, permission: memberPermission });
          } catch (error) {
            failed.push({
              userId,
              label: targetUser ? `${targetUser.displayName} · ${targetUser.email}` : userId,
              error: errorText(error)
            });
          }
        })
      );
      return { total: targets.length, failed };
    },
    onSuccess: (result) => {
      setGrantResult(result);
      const failedUserIds = new Set(result.failed.map((item) => item.userId));
      setSelectedMemberUserIds((current) => current.filter((userId) => failedUserIds.has(userId)));
      if (result.failed.length === 0) {
        setMemberSearch("");
        setMemberPermission("VIEWER");
      }
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-members", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => api.removeKnowledgeBaseMember(kbId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-base-members", kbId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
    }
  });

  function toggleMemberUser(userId: string) {
    setGrantResult(null);
    setSelectedMemberUserIds((current) => (
      current.includes(userId) ? current.filter((item) => item !== userId) : [...current, userId]
    ));
  }

  function toggleVisibleUsers() {
    setGrantResult(null);
    const visibleIds = filteredAvailableUsers.map((user) => user.id);
    if (allVisibleSelected) {
      setSelectedMemberUserIds((current) => current.filter((userId) => !visibleIds.includes(userId)));
      return;
    }
    setSelectedMemberUserIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  return (
    <div className="min-w-0 space-y-5">
      <Panel className="min-w-0">
        <PanelHeader
          title="成员与访问权限"
          description="控制哪些非管理员用户可以访问当前知识库；管理员无需单独授权。"
          actions={<Badge tone="slate">当前成员 {members.length}</Badge>}
        />
        <div className="space-y-4 p-5">
          <ErrorMessage error={usersQuery.error || membersQuery.error || removeMemberMutation.error} />
          {grantResult ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                grantResult.failed.length === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {grantResult.failed.length === 0 ? (
                <p>已成功授权 {grantResult.total} 个用户。</p>
              ) : (
                <details open>
                  <summary className="cursor-pointer select-none">
                    已处理 {grantResult.total} 个用户，其中 {grantResult.failed.length} 个失败。
                  </summary>
                  <div className="mt-2 space-y-1 text-xs leading-5">
                    {grantResult.failed.map((item) => (
                      <p key={item.userId} className="break-words">
                        {item.label}：{item.error}
                      </p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : null}

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
              <div className="space-y-4 border-b border-slate-100 p-4">
                <div>
                  <Label>授权角色</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {([
                      { value: "VIEWER", label: "只读问答", description: "仅可使用问答" },
                      { value: "EDITOR", label: "资料维护", description: "维护文档资料" },
                      { value: "MANAGER", label: "知识库管理", description: "成员、配置、索引" }
                    ] as Array<{ value: KnowledgeBaseMemberRequest["permission"]; label: string; description: string }>).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        className={cn(
                          "min-w-0 rounded-lg border px-3 py-2 text-left transition",
                          memberPermission === item.value
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                        onClick={() => {
                          setGrantResult(null);
                          setMemberPermission(item.value);
                        }}
                      >
                        <span className="block truncate text-sm font-medium">{item.label}</span>
                        <span className="block truncate text-xs">{item.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                  <Field label="待授权用户">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-9"
                        value={memberSearch}
                        placeholder="按用户名或邮箱搜索"
                        onChange={(event) => {
                          setGrantResult(null);
                          setMemberSearch(event.target.value);
                        }}
                      />
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" size="sm" disabled={filteredAvailableUsers.length === 0} onClick={toggleVisibleUsers}>
                      {allVisibleSelected ? "取消全选" : "全选当前"}
                    </Button>
                    {selectedMemberUserIds.length > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setGrantResult(null);
                          setSelectedMemberUserIds([]);
                        }}
                      >
                        清空
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      className="min-w-28"
                      disabled={selectedMemberUserIds.length === 0 || saveMembersMutation.isPending}
                      onClick={() => saveMembersMutation.mutate()}
                    >
                      <UserPlus className="h-4 w-4" />
                      {saveMembersMutation.isPending ? "授权中..." : selectedMemberUserIds.length > 0 ? `授权 ${selectedMemberUserIds.length} 人` : "选择后授权"}
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-slate-500">
                  {memberSearch.trim() ? `当前筛选 ${filteredAvailableUsers.length} 人` : `可选用户 ${availableUsers.length} 人`}
                  <span className="mx-1 text-slate-300">/</span>
                  已选 <span className="font-medium text-emerald-700">{selectedMemberUserIds.length}</span> 人
                </p>
              </div>

              <div className="max-h-[440px] space-y-2 overflow-y-auto p-3">
                {usersQuery.isLoading ? <p className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">正在加载用户...</p> : null}
                {!usersQuery.isLoading && filteredAvailableUsers.length === 0 ? (
                  <EmptyState title="没有可授权用户" description="可能所有普通用户都已授权，或当前搜索条件没有匹配结果。ADMIN 不需要知识库成员授权。" />
                ) : null}
                {filteredAvailableUsers.map((user) => {
                  const checked = selectedMemberUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      className={cn(
                        "flex w-full min-w-0 items-center gap-3 rounded-lg border bg-white p-3 text-left transition",
                        checked ? "border-emerald-300 bg-emerald-50/70" : "border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/40"
                      )}
                      onClick={() => toggleMemberUser(user.id)}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded border",
                          checked ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"
                        )}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-900">{user.displayName}</span>
                        <span className="block truncate text-xs text-slate-500">{user.email}</span>
                      </span>
                      <Badge tone={user.roles.includes("ADMIN") ? "rose" : user.roles.includes("KB_MANAGER") ? "cyan" : "slate"}>
                        {user.roles.includes("ADMIN") ? "ADMIN" : user.roles.includes("KB_MANAGER") ? "KB_MANAGER" : "USER"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">已授权成员</h3>
                  <p className="mt-0.5 text-xs text-slate-500">这些用户可以访问当前知识库。</p>
                </div>
                <Badge tone="slate">{members.length} 人</Badge>
              </div>
              <div className="max-h-[440px] space-y-2 overflow-y-auto p-3">
                {membersQuery.isLoading ? <p className="text-sm text-slate-500">正在加载成员...</p> : null}
                {!membersQuery.isLoading && members.length === 0 ? <EmptyState title="暂无授权成员" description="从左侧选择用户后，可以批量授权进入当前知识库。" /> : null}
                {members.map((member) => (
                  <div key={member.id} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{member.displayName}</p>
                      <p className="truncate text-xs text-slate-500">{member.email}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone={member.permission === "MANAGER" ? "green" : member.permission === "EDITOR" ? "cyan" : "slate"}>{member.permission}</Badge>
                      <button
                        type="button"
                        className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="移除授权"
                        disabled={removeMemberMutation.isPending}
                        onClick={() => {
                          setGrantResult(null);
                          removeMemberMutation.mutate(member.userId);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
