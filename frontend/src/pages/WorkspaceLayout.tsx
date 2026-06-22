import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Database, LogOut, Plus, Search, Settings, Sparkles } from "lucide-react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { clearAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import type { UserResponse } from "../types";

export default function WorkspaceLayout({ user }: { user: UserResponse | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const listQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });

  function logout() {
    clearAuth();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen bg-[#f7fbf8] text-slate-900">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-950">RAG 工作台</p>
              <p className="text-xs text-slate-500">Knowledge Studio</p>
            </div>
          </div>
          <Button className="mt-5 w-full" variant="secondary" onClick={() => navigate("/app/knowledge-bases")}>
            <Plus className="h-4 w-4" />
            新建知识库
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <NavLink
            to="/app/knowledge-bases"
            className={({ isActive }) =>
              cn(
                "mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                isActive && !params.id ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"
              )
            }
          >
            <Database className="h-4 w-4" />
            全部知识库
          </NavLink>
          <div className="mt-4 px-3 text-xs font-medium uppercase tracking-wide text-slate-400">知识库</div>
          <div className="mt-2 space-y-1">
            {listQuery.data?.map((kb) => (
              <NavLink
                key={kb.id}
                to={`/app/knowledge-bases/${kb.id}`}
                className={({ isActive }) =>
                  cn(
                    "block rounded-lg px-3 py-2 text-sm",
                    isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50"
                  )
                }
              >
                <span className="line-clamp-1 font-medium">{kb.name}</span>
                <span className="mt-0.5 block text-xs text-slate-400">TopK {kb.topK} · Chunk {kb.chunkSize}</span>
              </NavLink>
            ))}
            {listQuery.data?.length === 0 ? <p className="px-3 py-2 text-sm text-slate-400">暂无知识库</p> : null}
          </div>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="mb-3 rounded-lg bg-slate-50 p-3">
            <p className="line-clamp-1 text-sm font-medium text-slate-800">{user?.displayName ?? "用户"}</p>
            <p className="line-clamp-1 text-xs text-slate-500">{user?.email}</p>
          </div>
          <Button className="w-full" variant="ghost" onClick={logout}>
            <LogOut className="h-4 w-4" />
            退出登录
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-slate-950">知识库增强问答</p>
              <p className="hidden text-xs text-slate-500 sm:block">上传、检索、引用、问答</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/knowledge-bases")}>
              <Search className="h-4 w-4" />
              知识库
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <Settings className="h-4 w-4" />
              退出
            </Button>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
