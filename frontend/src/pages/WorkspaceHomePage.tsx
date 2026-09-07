import { useQuery } from "@tanstack/react-query";
import { BookOpen, Headphones } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorMessage, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { getWorkspaceCapabilities } from "../lib/workspace-permissions";
import { AdminPageLayout } from "./admin/components";
import { AdminSnapshot, KnowledgeSnapshot, ServiceOverview, SupportOperationsDashboard } from "./workspace-home/components";

export default function WorkspaceHomePage() {
  const navigate = useNavigate();
  const [statsWindowDays, setStatsWindowDays] = useState(7);
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me
  });
  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const knowledgeBases = Array.isArray(knowledgeBasesQuery.data) ? knowledgeBasesQuery.data : [];
  const capabilities = getWorkspaceCapabilities(meQuery.data, knowledgeBases);
  const ticketStatsQuery = useQuery({
    queryKey: ["support-ticket-stats", statsWindowDays],
    queryFn: () => api.getSupportTicketStats(statsWindowDays),
    enabled: capabilities.canViewSupport
  });
  const auditLogsQuery = useQuery({
    queryKey: ["admin-audit-logs-home"],
    queryFn: () => api.listAuditLogsPage({ page: 1, pageSize: 5 }),
    enabled: capabilities.canViewAdmin
  });
  const ticketStats = ticketStatsQuery.data;

  return (
    <AdminPageLayout>
      <PageHeader
        eyebrow="Service Desk AI"
        title="售后服务工作台"
        description="先处理客户问题，再维护知识依据；管理能力收进独立区域，减少主流程干扰。"
        actions={
          capabilities.canViewSupport ? (
            <Button onClick={() => navigate("/app/support-tickets")}>
              <Headphones className="h-4 w-4" />
              处理工单
            </Button>
          ) : capabilities.canViewKnowledge ? (
            <Button onClick={() => navigate("/app/knowledge-bases")}>
              <BookOpen className="h-4 w-4" />
              进入知识库
            </Button>
          ) : null
        }
      />
      <ErrorMessage error={(capabilities.canViewSupport ? ticketStatsQuery.error : undefined) || knowledgeBasesQuery.error || auditLogsQuery.error || meQuery.error} />

      <div className="space-y-4">
        <ServiceOverview
          ticketTotal={ticketStats?.total ?? 0}
          openTickets={ticketStats?.open ?? 0}
          inProgressTickets={ticketStats?.inProgress ?? 0}
          overdueTickets={ticketStats?.overdue ?? 0}
          loadingTickets={ticketStatsQuery.isLoading}
          knowledgeBases={knowledgeBases}
          loadingKnowledgeBases={knowledgeBasesQuery.isLoading}
          canViewSupport={capabilities.canViewSupport}
          canViewKnowledge={capabilities.canViewKnowledge}
          canViewAdmin={capabilities.canViewAdmin}
          onOpenTickets={() => navigate("/app/support-tickets")}
          onOpenKnowledgeBases={() => navigate("/app/knowledge-bases")}
          onOpenAdmin={() => navigate("/app/users")}
        />

        {capabilities.canViewSupport ? (
          <SupportOperationsDashboard
            stats={ticketStats}
            loading={ticketStatsQuery.isLoading}
            windowDays={statsWindowDays}
            onWindowDaysChange={setStatsWindowDays}
            onOpenTickets={() => navigate("/app/support-tickets")}
          />
        ) : null}

        {capabilities.canViewKnowledge || capabilities.canViewAdmin ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
            {capabilities.canViewKnowledge ? (
              <KnowledgeSnapshot
                knowledgeBases={knowledgeBases}
                loading={knowledgeBasesQuery.isLoading}
                onOpenKnowledgeBase={(id) => navigate(`/app/knowledge-bases/${id}`)}
                onOpenDirectory={() => navigate("/app/knowledge-bases")}
              />
            ) : null}
            <AdminSnapshot
              logs={auditLogsQuery.data?.items ?? []}
              loading={auditLogsQuery.isLoading}
              isAdmin={capabilities.canViewAdmin}
              onOpenAuditLogs={() => navigate("/app/audit-logs")}
            />
          </div>
        ) : null}
      </div>
    </AdminPageLayout>
  );
}
