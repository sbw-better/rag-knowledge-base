import { useQuery } from "@tanstack/react-query";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./lib/api";
import { getToken } from "./lib/auth";
import AuthPage from "./pages/AuthPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import KnowledgeBasesPage from "./pages/KnowledgeBasesPage";
import WorkspaceLayout from "./pages/WorkspaceLayout";

function ProtectedRoute() {
  const location = useLocation();
  const token = getToken();
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    enabled: Boolean(token)
  });

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (meQuery.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">正在加载工作台...</div>;
  }

  return <WorkspaceLayout user={meQuery.data ?? null} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={getToken() ? "/app/knowledge-bases" : "/login"} replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<Navigate to="/app/knowledge-bases" replace />} />
        <Route path="knowledge-bases" element={<KnowledgeBasesPage />} />
        <Route path="knowledge-bases/:id" element={<KnowledgeBasePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
