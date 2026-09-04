import { useQueries, useQuery } from "@tanstack/react-query";
import { Headphones } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorMessage, PageHeader } from "../components/ui";
import { api } from "../lib/api";
import { AdminPageLayout } from "./admin/components";
import { AdminSnapshot, KnowledgeSnapshot, ServiceOverview } from "./workspace-home/components";

export default function WorkspaceHomePage() {
  const navigate = useNavigate();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me
  });
  const ticketsQuery = useQuery({
    queryKey: ["support-tickets-home"],
    queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, status: "", priority: "" })
  });
  const ticketSummaryQueries = useQueries({
    queries: [
      {
        queryKey: ["support-tickets-home-summary", "OPEN"],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, status: "OPEN", priority: "" })
      },
      {
        queryKey: ["support-tickets-home-summary", "IN_PROGRESS"],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, status: "IN_PROGRESS", priority: "" })
      },
      {
        queryKey: ["support-tickets-home-summary", "OVERDUE"],
        queryFn: () => api.listSupportTicketsPage({ page: 1, pageSize: 1, status: "", priority: "", overdue: true })
      }
    ]
  });
  const knowledgeBasesQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const auditLogsQuery = useQuery({
    queryKey: ["admin-audit-logs-home"],
    queryFn: () => api.listAuditLogsPage({ page: 1, pageSize: 5 }),
    enabled: Boolean(meQuery.data?.roles.includes("ADMIN"))
  });
  const knowledgeBases = Array.isArray(knowledgeBasesQuery.data) ? knowledgeBasesQuery.data : [];
  const ticketTotal = ticketsQuery.data?.total ?? 0;
  const openTickets = ticketSummaryQueries[0].data?.total ?? 0;
  const inProgressTickets = ticketSummaryQueries[1].data?.total ?? 0;
  const overdueTickets = ticketSummaryQueries[2].data?.total ?? 0;
  const loadingTicketSummary = ticketsQuery.isLoading || ticketSummaryQueries.some((query) => query.isLoading);
  const isAdmin = Boolean(meQuery.data?.roles.includes("ADMIN"));

  return (
    <AdminPageLayout>
      <PageHeader
        eyebrow="Service Desk AI"
        title="售后服务工作台"
        description="先处理客户问题，再维护知识依据；管理能力收进独立区域，减少主流程干扰。"
        actions={
          <Button onClick={() => navigate("/app/support-tickets")}>
            <Headphones className="h-4 w-4" />
            处理工单
          </Button>
        }
      />
      <ErrorMessage error={ticketsQuery.error || ticketSummaryQueries.find((query) => query.error)?.error || knowledgeBasesQuery.error || auditLogsQuery.error || meQuery.error} />

      <div className="space-y-4">
        <ServiceOverview
          ticketTotal={ticketTotal}
          openTickets={openTickets}
          inProgressTickets={inProgressTickets}
          overdueTickets={overdueTickets}
          loadingTickets={loadingTicketSummary}
          knowledgeBases={knowledgeBases}
          loadingKnowledgeBases={knowledgeBasesQuery.isLoading}
          isAdmin={isAdmin}
          onOpenTickets={() => navigate("/app/support-tickets")}
          onOpenKnowledgeBases={() => navigate("/app/knowledge-bases")}
          onOpenAdmin={() => navigate("/app/users")}
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.85fr)]">
          <KnowledgeSnapshot
            knowledgeBases={knowledgeBases}
            loading={knowledgeBasesQuery.isLoading}
            onOpenKnowledgeBase={(id) => navigate(`/app/knowledge-bases/${id}`)}
            onOpenDirectory={() => navigate("/app/knowledge-bases")}
          />
          <AdminSnapshot
            logs={auditLogsQuery.data?.items ?? []}
            loading={auditLogsQuery.isLoading}
            isAdmin={isAdmin}
            onOpenAuditLogs={() => navigate("/app/audit-logs")}
          />
        </div>
      </div>
    </AdminPageLayout>
  );
}
