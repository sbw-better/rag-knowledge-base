import { Building2, ClipboardList, Database, Headphones, Home, Users } from "lucide-react";
import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";
import type { WorkspaceCapabilities } from "../lib/workspace-permissions";

type ServiceNavItem = {
  to: string;
  label: string;
  title: string;
  icon: ReactNode;
  end?: boolean;
  visible: (capabilities: WorkspaceCapabilities) => boolean;
};

type ServiceNavGroup = {
  title: string;
  adminOnly?: boolean;
  items: ServiceNavItem[];
};

const serviceNavGroups: ServiceNavGroup[] = [
  {
    title: "业务处理",
    items: [
      { to: "/app", label: "工作台首页", title: "工作台首页", icon: <Home className="h-4 w-4 shrink-0" />, end: true, visible: () => true },
      {
        to: "/app/support-tickets",
        label: "工单处理",
        title: "工单处理",
        icon: <Headphones className="h-4 w-4 shrink-0" />,
        visible: (capabilities) => capabilities.canViewSupport
      }
    ]
  },
  {
    title: "知识运营",
    items: [
      {
        to: "/app/knowledge-bases",
        label: "知识库运营",
        title: "知识库运营",
        icon: <Database className="h-4 w-4 shrink-0" />,
        end: true,
        visible: (capabilities) => capabilities.canViewKnowledge
      }
    ]
  },
  {
    title: "系统管理",
    items: [
      { to: "/app/users", label: "用户管理", title: "用户管理", icon: <Users className="h-4 w-4 shrink-0" />, visible: (capabilities) => capabilities.canViewAdmin },
      { to: "/app/tenants", label: "租户管理", title: "租户管理", icon: <Building2 className="h-4 w-4 shrink-0" />, visible: (capabilities) => capabilities.canViewAdmin },
      { to: "/app/audit-logs", label: "审计日志", title: "审计日志", icon: <ClipboardList className="h-4 w-4 shrink-0" />, visible: (capabilities) => capabilities.canViewAdmin }
    ]
  }
];

export function SidebarNavigation({
  collapsed,
  capabilities
}: {
  collapsed: boolean;
  capabilities: WorkspaceCapabilities;
}) {
  const groups = serviceNavGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.visible(capabilities)) }))
    .filter((group) => group.items.length > 0);

  return (
    <nav className={cn("flex-1 overflow-y-auto", collapsed ? "p-2" : "p-3")}>
      {groups.map((group) => (
        <SidebarSection key={group.title} title={group.title} collapsed={collapsed}>
          {group.items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} title={item.title} className={({ isActive }) => navClass(isActive, collapsed)}>
              {item.icon}
              <span className={cn(collapsed && "sr-only")}>{item.label}</span>
            </NavLink>
          ))}
        </SidebarSection>
      ))}
    </nav>
  );
}

export function MobileServiceNav({ capabilities }: { capabilities: WorkspaceCapabilities }) {
  const items = [
    { to: "/app", label: "首页", icon: <Home className="h-4 w-4" />, end: true },
    ...(capabilities.canViewSupport ? [{ to: "/app/support-tickets", label: "工单", icon: <Headphones className="h-4 w-4" /> }] : []),
    ...(capabilities.canViewKnowledge ? [{ to: "/app/knowledge-bases", label: "知识", icon: <Database className="h-4 w-4" /> }] : []),
    ...(capabilities.canViewAdmin ? [{ to: "/app/users", label: "管理", icon: <Users className="h-4 w-4" /> }] : [])
  ];

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 grid h-16 border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-lg shadow-slate-900/10 backdrop-blur lg:hidden",
        items.length >= 4 ? "grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-2"
      )}
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg text-xs font-medium transition",
              isActive ? "text-emerald-700" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )
          }
        >
          {item.icon}
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function headerCopy(pathname: string) {
  if (pathname.startsWith("/app/support-tickets")) {
    return { title: "工单处理", description: "客户问题、业务上下文和 AI 回复草稿" };
  }
  if (pathname.startsWith("/app/knowledge-bases")) {
    return { title: "知识运营", description: "维护资料、调试助手和处理知识缺口" };
  }
  if (pathname.startsWith("/app/users") || pathname.startsWith("/app/tenants") || pathname.startsWith("/app/audit-logs")) {
    return { title: "系统管理", description: "用户、租户和审计日志" };
  }
  return { title: "售后服务工作台", description: "围绕售后工单组织知识库能力" };
}

function SidebarSection({ title, collapsed, children }: { title: string; collapsed: boolean; children: ReactNode }) {
  return (
    <section className="mt-2 first:mt-0">
      <div className={cn("mb-2 px-3 text-xs font-medium text-slate-400", collapsed && "sr-only")}>{title}</div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function navClass(isActive: boolean, collapsed: boolean) {
  return cn(
    "flex items-center rounded-lg text-sm font-medium transition",
    collapsed ? "h-10 justify-center px-0" : "h-10 gap-2 px-3",
    isActive ? "bg-emerald-50 text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
  );
}
