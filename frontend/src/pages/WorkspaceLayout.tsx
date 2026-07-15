import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Building2, ChevronDown, Database, LogOut, PanelLeftClose, PanelLeftOpen, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("ragkb.sidebarCollapsed") === "true");
  const listQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const knowledgeBases = Array.isArray(listQuery.data) ? listQuery.data : [];
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));

  useEffect(() => {
    localStorage.setItem("ragkb.sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  function logout() {
    clearAuth();
    queryClient.clear();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen max-w-full overflow-x-hidden bg-slate-50 text-slate-900">
      <aside
        className={cn(
          "hidden shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex lg:flex-col",
          sidebarCollapsed ? "w-[4.5rem]" : "w-[17rem]"
        )}
      >
        <div className={cn("border-b border-slate-100", sidebarCollapsed ? "p-3" : "p-4")}>
          <div className={cn("flex items-center", sidebarCollapsed ? "flex-col gap-2" : "justify-between gap-3")}>
            <div className={cn("flex min-w-0 items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-900/10">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className={cn(sidebarCollapsed && "sr-only")}>
                <p className="text-sm font-semibold text-slate-950">RAG 工作台</p>
                <p className="text-xs text-slate-500">Knowledge Studio</p>
              </div>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <nav className={cn("flex-1 overflow-y-auto", sidebarCollapsed ? "p-2" : "p-3")}>
          <div className="space-y-1">
            <NavLink
              to="/app/knowledge-bases"
              title="全部知识库"
              className={({ isActive }) =>
                cn(
                  "flex items-center rounded-lg text-sm font-medium transition",
                  sidebarCollapsed ? "h-10 justify-center px-0" : "h-10 gap-2 px-3",
                  isActive && !params.id ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )
              }
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className={cn(sidebarCollapsed && "sr-only")}>全部知识库</span>
            </NavLink>
          </div>

          <div className={cn("mt-5 flex items-center justify-between px-3 text-xs font-medium text-slate-400", sidebarCollapsed && "sr-only")}>
            <span>知识库</span>
            <span>{knowledgeBases.length}</span>
          </div>
          <div className="mt-2 space-y-1">
            {knowledgeBases.map((kb) => (
              <NavLink
                key={kb.id}
                to={`/app/knowledge-bases/${kb.id}`}
                title={kb.name}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg text-sm transition",
                    sidebarCollapsed ? "grid h-10 place-items-center px-0" : "flex h-10 min-w-0 items-center px-3",
                    isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )
                }
              >
                {sidebarCollapsed ? (
                  <span className="grid h-7 w-7 place-items-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">{kb.name.slice(0, 1)}</span>
                ) : (
                  <span className="truncate font-medium">{kb.name}</span>
                )}
              </NavLink>
            ))}
            {!listQuery.isLoading && !listQuery.error && knowledgeBases.length === 0 && !sidebarCollapsed ? (
              <p className="px-3 py-2 text-sm text-slate-400">暂无知识库</p>
            ) : null}
          </div>
          {isAdmin ? (
            <>
              <div className={cn("mt-5 px-3 text-xs font-medium text-slate-400", sidebarCollapsed && "sr-only")}>管理</div>
              <NavLink
                to="/app/users"
                title="用户管理"
                className={({ isActive }) =>
                  cn(
                    "mt-2 flex items-center rounded-lg text-sm font-medium transition",
                    sidebarCollapsed ? "h-10 justify-center px-0" : "h-10 gap-2 px-3",
                    isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )
                }
              >
                <Users className="h-4 w-4" />
                <span className={cn(sidebarCollapsed && "sr-only")}>用户管理</span>
              </NavLink>
              <NavLink
                to="/app/tenants"
                title="租户管理"
                className={({ isActive }) =>
                  cn(
                    "mt-1 flex items-center rounded-lg text-sm font-medium transition",
                    sidebarCollapsed ? "h-10 justify-center px-0" : "h-10 gap-2 px-3",
                    isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )
                }
              >
                <Building2 className="h-4 w-4" />
                <span className={cn(sidebarCollapsed && "sr-only")}>租户管理</span>
              </NavLink>
            </>
          ) : null}
        </nav>
      </aside>

      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">知识库增强问答</p>
              <p className="hidden text-xs text-slate-500 sm:block">知识库问答与内容管理</p>
            </div>
          </div>
          <AccountMenu user={user} onLogout={logout} />
        </header>
        <Outlet />
      </main>
    </div>
  );
}

function AccountMenu({ user, onLogout }: { user: UserResponse | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.displayName || "用户";
  const email = user?.email || "";
  const initial = (displayName || email || "U").slice(0, 1).toUpperCase();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="flex h-10 items-center gap-3 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-sm shadow-sm shadow-slate-900/5 transition hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-xs font-semibold text-white">{initial}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-32 truncate font-medium text-slate-800">{displayName}</span>
          <span className="block max-w-32 truncate text-xs text-slate-500">{email}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="line-clamp-1 text-sm font-medium text-slate-900">{displayName}</p>
            <p className="mt-0.5 break-all text-xs text-slate-500">{email}</p>
          </div>
          <div className="p-2">
            <Button className="w-full justify-start" variant="ghost" onClick={onLogout}>
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
