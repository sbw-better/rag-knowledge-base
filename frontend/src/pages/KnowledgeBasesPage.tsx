import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Database, Plus, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Modal, PageHeader, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";

export default function KnowledgeBasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [topK, setTopK] = useState(5);
  const createOpen = searchParams.get("create") === "1";

  const listQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });
  const knowledgeBases = Array.isArray(listQuery.data) ? listQuery.data : [];

  const createMutation = useMutation({
    mutationFn: () => api.createKnowledgeBase({ name: name.trim(), description: description.trim(), chunkSize, chunkOverlap, topK }),
    onSuccess: (kb) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      setName("");
      setDescription("");
      setChunkSize(800);
      setChunkOverlap(120);
      setTopK(5);
      setSearchParams({});
      navigate(`/app/knowledge-bases/${kb.id}`);
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) {
      createMutation.mutate();
    }
  }

  function openCreate() {
    setSearchParams({ create: "1" });
  }

  function closeCreate() {
    setSearchParams({});
    createMutation.reset();
  }

  return (
    <div className="mx-auto max-w-7xl min-w-0 max-w-full p-4 lg:p-8">
      <PageHeader
        title="知识库"
        description="按业务场景组织文档，分别完成检索和增强问答。"
        actions={
          <>
            <Button variant="secondary" onClick={() => listQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              新建知识库
            </Button>
          </>
        }
      />

      {listQuery.isLoading ? <div className="text-sm text-slate-500">正在加载知识库...</div> : null}
      <ErrorMessage error={listQuery.error} />
      {!listQuery.isLoading && !listQuery.error && knowledgeBases.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
          <EmptyState title="还没有知识库" description="创建一个业务知识库后，就可以上传文档并开始检索问答。" />
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {knowledgeBases.map((kb) => (
          <button
            key={kb.id}
            className="group rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-900/5 transition hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5"
            onClick={() => navigate(`/app/knowledge-bases/${kb.id}`)}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                <Database className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
            </div>
            <h2 className="line-clamp-1 text-base font-semibold text-slate-950">{kb.name}</h2>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">{kb.description || "未填写描述"}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="green">TopK {kb.topK}</Badge>
              <Badge tone="cyan">Chunk {kb.chunkSize}</Badge>
              <Badge>Overlap {kb.chunkOverlap}</Badge>
            </div>
            <p className="mt-4 text-xs text-slate-400">创建于 {formatDateTime(kb.createdAt)}</p>
          </button>
        ))}
      </div>

      <Modal open={createOpen} title="创建知识库" description="建议一个业务主题对应一个知识库，后续可在设置中调整参数。" onClose={closeCreate}>
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="名称">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：客服知识库" required maxLength={160} />
          </Field>
          <Field label="描述">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明该知识库的业务范围" maxLength={2000} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Chunk">
              <Input type="number" min={200} max={4000} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} />
            </Field>
            <Field label="Overlap">
              <Input type="number" min={0} max={1000} value={chunkOverlap} onChange={(event) => setChunkOverlap(Number(event.target.value))} />
            </Field>
            <Field label="TopK">
              <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
            </Field>
          </div>
          <ErrorMessage error={createMutation.error} />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeCreate}>
              取消
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
              <Plus className="h-4 w-4" />
              {createMutation.isPending ? "创建中..." : "创建并进入"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
