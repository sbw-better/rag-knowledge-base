import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Badge, Button, ErrorMessage, Field, Input, Panel, PanelHeader, Textarea } from "../../components/ui";
import { api } from "../../lib/api";

export function KnowledgeBaseConfigPanel({ kb }: { kb: { id: string; name: string; description: string | null; chunkSize: number; chunkOverlap: number; topK: number; minScore: number } }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(kb.name);
  const [description, setDescription] = useState(kb.description ?? "");
  const [chunkSize, setChunkSize] = useState(kb.chunkSize);
  const [chunkOverlap, setChunkOverlap] = useState(kb.chunkOverlap);
  const [topK, setTopK] = useState(kb.topK);
  const [minScore, setMinScore] = useState(kb.minScore ?? 0);

  const updateMutation = useMutation({
    mutationFn: () => api.updateKnowledgeBase(kb.id, { name, description, chunkSize, chunkOverlap, topK, minScore }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-bases"] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-base", kb.id] });
    }
  });

  return (
    <Panel className="min-w-0">
      <PanelHeader title="知识库配置" description="这里维护知识库的基础信息和默认参数。普通问答用户不会看到这些配置。" />
      <form
        className="grid min-w-0 gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_340px]"
        onSubmit={(event) => {
          event.preventDefault();
          updateMutation.mutate();
        }}
      >
        <div className="min-w-0 space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-slate-900">基础信息</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">用于区分业务场景，会展示给有权限访问该知识库的成员。</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
              <Field label="知识库名称">
                <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={160} />
              </Field>
              <Field label="业务说明">
                <Textarea className="min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-4 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">默认参数</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">影响后续入库切分和默认问答召回，不展示给普通问答用户。</p>
              </div>
              <Badge tone="cyan">维护人员可见</Badge>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="切片长度">
                <Input type="number" min={200} max={4000} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} />
              </Field>
              <Field label="重叠长度">
                <Input type="number" min={0} max={1000} value={chunkOverlap} onChange={(event) => setChunkOverlap(Number(event.target.value))} />
              </Field>
              <Field label="默认召回数">
                <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
              </Field>
              <Field label="最低相关度">
                <Input type="number" min={0} max={1} step={0.01} value={minScore} onChange={(event) => setMinScore(Number(event.target.value))} />
              </Field>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-sm font-semibold text-slate-900">参数说明</h3>
            <dl className="mt-3 space-y-3 text-xs leading-5 text-slate-500">
              <div>
                <dt className="font-medium text-slate-700">切片长度</dt>
                <dd>单个文档片段的大致长度。数值越大，片段包含上下文越多，但召回粒度更粗。</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">重叠长度</dt>
                <dd>相邻片段保留的重叠长度，用于减少切片边界导致的语义断裂。</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">默认召回数</dt>
                <dd>问答默认召回的片段数量。检索调试页里的临时召回数不会覆盖这里。</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-700">最低相关度</dt>
                <dd>最低召回分数。0 表示不过滤；适当提高可以减少不相关问题也显示来源的情况。</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">保存修改</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">保存后会影响后续上传入库、检索和问答默认召回。</p>
            <ErrorMessage error={updateMutation.error} />
            <Button className="mt-4 w-full" type="submit" disabled={updateMutation.isPending}>
              <RefreshCw className="h-4 w-4" />
              {updateMutation.isPending ? "保存中..." : "保存配置"}
            </Button>
          </section>
        </aside>
      </form>
    </Panel>
  );
}

