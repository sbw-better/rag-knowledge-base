import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Database, Plus, RefreshCw } from "lucide-react";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Panel, PanelHeader, Textarea } from "../components/ui";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";

export default function KnowledgeBasesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [topK, setTopK] = useState(5);

  const listQuery = useQuery({
    queryKey: ["knowledge-bases"],
    queryFn: api.listKnowledgeBases
  });

  const createMutation = useMutation({
    mutationFn: () => api.createKnowledgeBase({ name, description, chunkSize, chunkOverlap, topK }),
    onSuccess: (kb) => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      setName("");
      setDescription("");
      navigate(`/app/knowledge-bases/${kb.id}`);
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-5 p-4 lg:grid-cols-[1fr_360px] lg:p-8">
      <section className="min-w-0">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950">知识库</h1>
            <p className="mt-1 text-sm text-slate-500">按业务场景组织文档，分别完成检索和增强问答。</p>
          </div>
          <Button variant="secondary" onClick={() => listQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
            刷新
          </Button>
        </div>

        {listQuery.isLoading ? <div className="text-sm text-slate-500">正在加载知识库...</div> : null}
        <ErrorMessage error={listQuery.error} />
        {listQuery.data?.length === 0 ? (
          <EmptyState title="还没有知识库" description="创建一个业务知识库后，就可以上传文档并开始检索问答。" />
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listQuery.data?.map((kb) => (
            <button
              key={kb.id}
              className="group rounded-lg border border-slate-200 bg-white p-5 text-left transition hover:border-emerald-200 hover:shadow-sm"
              onClick={() => navigate(`/app/knowledge-bases/${kb.id}`)}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
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
      </section>

      <Panel className="h-fit">
        <PanelHeader title="创建知识库" description="建议一个业务主题对应一个知识库。" />
        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="名称">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：客服知识库" required />
          </Field>
          <Field label="描述">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明该知识库的业务范围" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
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
          <Button className="w-full" type="submit" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4" />
            {createMutation.isPending ? "创建中..." : "创建并进入"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
