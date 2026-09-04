import { FileText, MessageSquare, Search, Settings, ShieldAlert, Users, type LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type KnowledgeBaseTab = "documents" | "search" | "chat" | "members" | "config" | "operations";

type KnowledgeBaseTabItem = {
  id: KnowledgeBaseTab;
  label: string;
  icon: LucideIcon;
};

const knowledgeBaseTabs: KnowledgeBaseTabItem[] = [
  { id: "documents", label: "资料维护", icon: FileText },
  { id: "chat", label: "助手调试", icon: MessageSquare },
  { id: "operations", label: "运营闭环", icon: ShieldAlert },
  { id: "search", label: "检索调试", icon: Search },
  { id: "members", label: "权限成员", icon: Users },
  { id: "config", label: "知识库设置", icon: Settings }
];

export function getVisibleKnowledgeBaseTabs({
  canManageDocuments,
  canManageMembers,
  canManageConfig,
  canUseOperations
}: {
  canManageDocuments: boolean;
  canManageMembers: boolean;
  canManageConfig: boolean;
  canUseOperations: boolean;
}) {
  return knowledgeBaseTabs.filter((tab) => {
    if (tab.id === "chat") {
      return true;
    }
    if (tab.id === "documents" || tab.id === "search") {
      return canManageDocuments;
    }
    if (tab.id === "members") {
      return canManageMembers;
    }
    if (tab.id === "config") {
      return canManageConfig;
    }
    if (tab.id === "operations") {
      return canUseOperations;
    }
    return false;
  });
}

export function KnowledgeBaseTabs({
  tabs,
  activeTab,
  onChange
}: {
  tabs: KnowledgeBaseTabItem[];
  activeTab: KnowledgeBaseTab;
  onChange: (tab: KnowledgeBaseTab) => void;
}) {
  return (
    <div className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1 shadow-sm shadow-slate-900/5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition",
              activeTab === tab.id ? "bg-emerald-50 text-emerald-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            )}
            onClick={() => onChange(tab.id)}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
