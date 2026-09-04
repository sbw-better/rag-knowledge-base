import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, PageHeader, Pagination } from "../components/ui";
import { api } from "../lib/api";
import type { KnowledgeBaseRequest } from "../types";
import { AdminPageLayout } from "./admin/components";
import { CreateKnowledgeBaseModal, KnowledgeBaseDirectory } from "./knowledge-bases/components";

const PAGE_SIZE = 9;

export default function KnowledgeBasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const requestedCreateOpen = searchParams.get("create") === "1";

  const listQuery = useQuery({
    queryKey: ["knowledge-bases-page", page, PAGE_SIZE, keyword],
    queryFn: () => api.listKnowledgeBasesPage({ page, pageSize: PAGE_SIZE, keyword })
  });
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: api.me
  });
  const pageData = listQuery.data;
  const visibleKnowledgeBases = pageData?.items ?? [];
  const total = pageData?.total ?? 0;
  const safePage = pageData?.page ?? page;
  const totalPages = pageData?.totalPages ?? 1;
  const canCreateKnowledgeBase = Boolean(meQuery.data?.roles.some((role) => role === "ADMIN" || role === "KB_MANAGER"));
  const createOpen = canCreateKnowledgeBase && requestedCreateOpen;

  useEffect(() => {
    setPage(1);
  }, [keyword]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const createMutation = useMutation({
    mutationFn: (payload: KnowledgeBaseRequest) => api.createKnowledgeBase(payload),
    onSuccess: (kb) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases-page"] });
      setSearchParams({});
      navigate(`/app/knowledge-bases/${kb.id}`);
    }
  });

  function openCreate() {
    setSearchParams({ create: "1" });
  }

  function closeCreate() {
    setSearchParams({});
    createMutation.reset();
  }

  return (
    <AdminPageLayout>
      <PageHeader
        eyebrow="知识运营"
        title="知识库运营"
        description="维护售后政策、FAQ、商品说明和处理流程，为工单回复提供依据。"
        actions={
          <>
            <Button variant="secondary" onClick={() => listQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            {canCreateKnowledgeBase ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                新建知识库
              </Button>
            ) : null}
          </>
        }
      />

      <KnowledgeBaseDirectory
        knowledgeBases={visibleKnowledgeBases}
        total={total}
        keyword={keyword}
        loading={listQuery.isLoading}
        error={listQuery.error}
        canCreate={canCreateKnowledgeBase}
        onKeywordChange={setKeyword}
        onOpen={(id) => navigate(`/app/knowledge-bases/${id}`)}
        onCreate={openCreate}
      />
      <Pagination page={safePage} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />

      <CreateKnowledgeBaseModal
        open={createOpen}
        pending={createMutation.isPending}
        error={createMutation.error}
        onClose={closeCreate}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />
    </AdminPageLayout>
  );
}
