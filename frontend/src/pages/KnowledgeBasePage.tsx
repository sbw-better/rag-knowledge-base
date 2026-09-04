import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge, ErrorMessage, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { ChatPanel } from "./knowledge-base/chat-panel";
import { KnowledgeBaseConfigPanel } from "./knowledge-base/config-panel";
import { DocumentsPanel } from "./knowledge-base/documents-panel";
import { MembersPanel } from "./knowledge-base/members-panel";
import { OperationsPanel } from "./knowledge-base/operations-panel";
import { SearchPanel } from "./knowledge-base/search-panel";
import { getVisibleKnowledgeBaseTabs, KnowledgeBaseTabs, type KnowledgeBaseTab } from "./knowledge-base/tabs";

export default function KnowledgeBasePage() {
  const { id } = useParams();
  const kbId = id ?? "";
  const [activeTab, setActiveTab] = useState<KnowledgeBaseTab>("documents");

  const kbQuery = useQuery({
    queryKey: ["knowledge-base", kbId],
    queryFn: () => api.getKnowledgeBase(kbId),
    enabled: Boolean(kbId)
  });
  const kb = kbQuery.data;
  const canManageDocuments = Boolean(kb?.canManageDocuments);
  const canManageMembers = Boolean(kb?.canManageMembers);
  const canManageConfig = Boolean(kb?.canManageConfig);
  const canUseOperations = Boolean(kb?.canManageOperations || kb?.canDelete);
  const manageable = Boolean(kb?.manageable);
  const visibleTabs = useMemo(
    () => getVisibleKnowledgeBaseTabs({ canManageDocuments, canManageMembers, canManageConfig, canUseOperations }),
    [canManageConfig, canManageDocuments, canManageMembers, canUseOperations]
  );

  useEffect(() => {
    if (kbQuery.data && !visibleTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("chat");
    }
  }, [activeTab, kbQuery.data, visibleTabs]);

  return (
    <div className="mx-auto w-full max-w-[100rem] min-w-0 p-4 lg:p-6">
      <PageHeader
        eyebrow="知识运营"
        title={kbQuery.data?.name ?? "正在加载..."}
        description={kbQuery.data?.description || "未填写描述"}
        actions={
          kbQuery.data && manageable ? (
            <>
              <Badge tone="slate">{kbQuery.data.permission}</Badge>
              <Badge tone="green">可维护</Badge>
            </>
          ) : null
        }
      />

      <KnowledgeBaseTabs tabs={visibleTabs} activeTab={activeTab} onChange={setActiveTab} />

      <ErrorMessage error={kbQuery.error} />
      {activeTab === "documents" && canManageDocuments ? <DocumentsPanel kbId={kbId} /> : null}
      {activeTab === "search" && canManageDocuments ? <SearchPanel kbId={kbId} defaultTopK={kbQuery.data?.topK ?? 5} /> : null}
      {activeTab === "chat" ? <ChatPanel kbId={kbId} defaultTopK={kbQuery.data?.topK ?? 5} /> : null}
      {activeTab === "members" && kbQuery.data && canManageMembers ? <MembersPanel kbId={kbQuery.data.id} /> : null}
      {activeTab === "config" && kbQuery.data && canManageConfig ? <KnowledgeBaseConfigPanel kb={kbQuery.data} /> : null}
      {activeTab === "operations" && kbQuery.data && canUseOperations ? <OperationsPanel kb={kbQuery.data} /> : null}
    </div>
  );
}

