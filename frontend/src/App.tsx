import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Button, ErrorMessage } from "./components/ui";
import { api } from "./lib/api";
import { clearAuth, getToken } from "./lib/auth";
import AuthPage from "./pages/AuthPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import KnowledgeBasesPage from "./pages/KnowledgeBasesPage";
import SupportTicketsPage from "./pages/SupportTicketsPage";
import TenantsPage from "./pages/TenantsPage";
import UsersPage from "./pages/UsersPage";
import WorkspaceHomePage from "./pages/WorkspaceHomePage";
import WorkspaceLayout from "./pages/WorkspaceLayout";

/**
 * 受保护路由。
 *
 * <p>这里先检查本地 token，再调用 /auth/me 校验 token 是否仍有效。校验失败时给用户
 * 重试和重新登录入口，避免后端重启或 token 过期时出现空白页。</p>
 */
function ProtectedRoute() {
  const location = useLocation();
  const token = getToken();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: Boolean(token),
    retry: false
  });

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (meQuery.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">正在加载工作台...</div>;
  }

  if (meQuery.isError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-950">无法进入工作台</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">当前登录态校验失败，可以重试；如果 token 已失效，请退出后重新登录。</p>
          <div className="mt-4">
            <ErrorMessage error={meQuery.error} />
          </div>
          <div className="mt-5 flex gap-3">
            <Button variant="secondary" onClick={() => meQuery.refetch()}>
              重试
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearAuth();
                window.location.href = "/login";
              }}
            >
              重新登录
            </Button>
          </div>
        </section>
      </main>
    );
  }

  return <WorkspaceLayout user={meQuery.data ?? null} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={getToken() ? "/app" : "/login"} replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<WorkspaceHomePage />} />
        <Route path="knowledge-bases" element={<KnowledgeBasesPage />} />
        <Route path="knowledge-bases/:id" element={<KnowledgeBasePage />} />
        <Route path="support-tickets" element={<SupportTicketsPage />} />
        <Route path="support-tickets/:id" element={<SupportTicketsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="tenants" element={<TenantsPage />} />
        <Route path="audit-logs" element={<AuditLogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
