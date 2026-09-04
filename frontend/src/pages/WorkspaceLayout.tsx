import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { api } from "../lib/api";
import { clearAuth } from "../lib/auth";
import { cn } from "../lib/utils";
import type { UserResponse } from "../types";
import { headerCopy, MobileServiceNav, SidebarNavigation } from "./workspace-navigation";

export default function WorkspaceLayout({ user }: { user: UserResponse | null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("ragkb.sidebarCollapsed") === "true");
  const listQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const knowledgeBases = Array.isArray(listQuery.data) ? listQuery.data : [];
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const header = headerCopy(location.pathname);

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
                <p className="text-sm font-semibold text-slate-950">售后知识助手</p>
                <p className="text-xs text-slate-500">Service Desk AI</p>
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

        <SidebarNavigation collapsed={sidebarCollapsed} isAdmin={isAdmin} knowledgeBases={knowledgeBases} />
      </aside>

      <main className="min-w-0 max-w-full flex-1 overflow-x-hidden pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-950">{header.title}</p>
              <p className="hidden text-xs text-slate-500 sm:block">{header.description}</p>
            </div>
          </div>
          <AccountMenu user={user} onLogout={logout} />
        </header>
        <Outlet />
      </main>
      <MobileServiceNav isAdmin={isAdmin} />
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
    <div ref={menuRef} className="relative max-w-[55vw] sm:max-w-none">
      <button
        type="button"
        className="flex h-10 max-w-[13.5rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-left text-sm shadow-sm shadow-slate-900/5 transition hover:border-slate-300 hover:bg-slate-50 sm:max-w-[16rem]"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-xs font-semibold text-white">{initial}</span>
        <span className="hidden min-w-0 flex-1 sm:block">
          <span className="block truncate font-medium text-slate-800">{displayName}</span>
          <span className="block truncate text-xs text-slate-500">{email}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="break-words text-sm font-medium leading-5 text-slate-900">{displayName}</p>
            <p className="mt-1 break-all text-xs leading-5 text-slate-500">{email}</p>
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
