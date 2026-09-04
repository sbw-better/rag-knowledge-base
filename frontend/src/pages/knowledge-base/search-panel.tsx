import { useMutation } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Panel, PanelHeader, Textarea } from "../../components/ui";
import { api } from "../../lib/api";
import { cn, shortId } from "../../lib/utils";
import type { SearchHit, SearchMode } from "../../types";

export function SearchPanel({ kbId, defaultTopK }: { kbId: string; defaultTopK: number }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("HYBRID");
  const [topK, setTopK] = useState(defaultTopK);
  const searchModes: Array<{ value: SearchMode; title: string; description: string }> = [
    { value: "HYBRID", title: "混合检索", description: "优先推荐，同时结合语义和关键词" },
    { value: "VECTOR", title: "语义检索", description: "适合意思相近但表达不同的问题" },
    { value: "KEYWORD", title: "关键词检索", description: "适合精确术语、编号、字段名称" }
  ];

  const searchMutation = useMutation({
    mutationFn: () => api.search({ knowledgeBaseId: kbId, query, mode, topK })
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    searchMutation.mutate();
  }

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
      <Panel className="h-fit overflow-hidden">
        <PanelHeader title="检索调试" description="用于验证文档切片和召回效果，参数只影响本次调试。" />
        <form onSubmit={submit} className="space-y-5 p-5">
          <Field label="问题或关键词">
            <Textarea
              className="min-h-32"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="输入要验证召回效果的问题，例如：退款多久到账？"
              required
            />
          </Field>

          <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-slate-900">检索策略</h3>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">普通使用建议选择混合检索。</p>
              </div>
              <Badge tone="cyan">{mode}</Badge>
            </div>
            <div className="grid gap-2">
              {searchModes.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    mode === item.value
                      ? "border-emerald-300 bg-white text-emerald-800 shadow-sm shadow-emerald-950/5 ring-1 ring-emerald-100"
                      : "border-slate-200 bg-white text-slate-700 hover:border-cyan-200 hover:bg-cyan-50/50"
                  )}
                  onClick={() => setMode(item.value)}
                >
                  <span className="block text-sm font-medium">{item.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="本次召回数量">
                <Input type="number" min={1} max={50} value={topK} onChange={(event) => setTopK(Number(event.target.value))} />
              </Field>
              <p className="max-w-48 text-xs leading-5 text-slate-500">只影响这次调试，不会覆盖知识库默认配置。</p>
            </div>
          </section>

          <ErrorMessage error={searchMutation.error} />
          <Button className="w-full" type="submit" disabled={searchMutation.isPending}>
            <Search className="h-4 w-4" />
            {searchMutation.isPending ? "检索中..." : "开始检索"}
          </Button>
        </form>
      </Panel>

      <Panel className="min-w-0">
        <PanelHeader
          title="命中片段"
          description="展示召回来源、分数和文本内容。"
          actions={searchMutation.data ? <Badge tone="slate">{searchMutation.data.hits.length} 条结果</Badge> : null}
        />
        <div className="min-h-[420px] space-y-3 p-5">
          {searchMutation.data?.hits.length === 0 ? <EmptyState title="没有命中结果" description="可以尝试更换问题、模式或等待文档入库完成。" /> : null}
          {!searchMutation.data ? <EmptyState title="等待检索" description="提交一个问题后，这里会显示命中的文档片段。" /> : null}
          {searchMutation.data?.hits.map((hit) => (
            <SearchHitCard key={hit.chunkId} hit={hit} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SearchHitCard({ hit }: { hit: SearchHit }) {
  return (
    <article className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="line-clamp-1 text-sm font-medium text-slate-900">{hit.fileName}</p>
          <p className="mt-0.5 text-xs text-slate-500">Chunk #{hit.chunkIndex} · {shortId(hit.chunkId)}</p>
        </div>
        <div className="flex gap-2">
          <Badge tone="cyan">{hit.source}</Badge>
          <Badge tone="green">{hit.score.toFixed(4)}</Badge>
        </div>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{hit.content}</p>
    </article>
  );
}


