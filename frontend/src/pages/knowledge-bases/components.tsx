import { ArrowRight, Database, Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Badge, Button, EmptyState, ErrorMessage, Field, Input, Modal, Panel, PanelHeader, Textarea } from "../../components/ui";
import { formatDateTime } from "../../lib/utils";
import type { KnowledgeBaseRequest, KnowledgeBaseResponse } from "../../types";
import { EntityAvatar, FilterBar, RecordCard, RecordList, SearchField } from "../admin/components";

export function KnowledgeBaseDirectory({
  knowledgeBases,
  total,
  keyword,
  loading,
  error,
  canCreate,
  onKeywordChange,
  onOpen,
  onCreate
}: {
  knowledgeBases: KnowledgeBaseResponse[];
  total: number;
  keyword: string;
  loading: boolean;
  error: unknown;
  canCreate: boolean;
  onKeywordChange: (value: string) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const showSearch = total > 0 || keyword;

  return (
    <Panel>
      <PanelHeader
        title="知识库目录"
        description="只展示每个知识库的用途、权限和核心检索参数；资料、成员和任务进入详情页处理。"
        actions={<Badge tone="slate">共 {total} 个</Badge>}
      />
      {showSearch ? (
        <FilterBar>
          <SearchField className="max-w-xl" value={keyword} onChange={onKeywordChange} placeholder="搜索知识库名称或描述" />
        </FilterBar>
      ) : null}
      <RecordList
        className="space-y-3"
        loading={loading}
        loadingText="正在加载知识库..."
        empty={
          <>
            {!error && total === 0 && !keyword ? (
              <EmptyState
                title="还没有可用知识库"
                description={canCreate ? "创建售后知识库后，就可以上传政策、FAQ 和商品资料。" : "管理员或知识库负责人授权后，你可以在这里进入知识运营。"}
              />
            ) : null}
            {!error && total === 0 && keyword ? <EmptyState title="没有匹配的知识库" description="可以更换搜索关键词，或清空搜索条件后查看全部知识库。" /> : null}
          </>
        }
      >
        <ErrorMessage error={error} />
        {knowledgeBases.map((kb) => (
          <KnowledgeBaseListItem key={kb.id} kb={kb} onOpen={() => onOpen(kb.id)} />
        ))}
        {canCreate && total === 0 && !keyword && !loading ? (
          <Button className="w-full" variant="secondary" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            创建第一个知识库
          </Button>
        ) : null}
      </RecordList>
    </Panel>
  );
}

function KnowledgeBaseListItem({ kb, onOpen }: { kb: KnowledgeBaseResponse; onOpen: () => void }) {
  return (
    <RecordCard className="grid gap-4 transition hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-900/5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <button type="button" className="flex min-w-0 items-start gap-3 text-left" onClick={onOpen}>
        <EntityAvatar tone={kb.manageable ? "green" : "slate"}>
          <Database className="h-5 w-5" />
        </EntityAvatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-words text-base font-semibold text-slate-950">{kb.name}</h2>
            <Badge tone={kb.manageable ? "green" : "slate"}>{kb.manageable ? "可维护" : "已授权"}</Badge>
            <Badge tone="cyan">{kb.permission}</Badge>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{kb.description || "未填写描述"}</p>
          <p className="mt-2 text-xs text-slate-400">创建于 {formatDateTime(kb.createdAt)}</p>
        </div>
      </button>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center lg:min-w-[25rem]">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="切片" value={kb.chunkSize} />
          <MiniMetric label="召回" value={kb.topK} />
          <MiniMetric label="阈值" value={kb.minScore} />
        </div>
        <Button variant="secondary" onClick={onOpen}>
          进入
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </RecordCard>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

export function CreateKnowledgeBaseModal({
  open,
  pending,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (payload: KnowledgeBaseRequest) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [chunkSize, setChunkSize] = useState(800);
  const [chunkOverlap, setChunkOverlap] = useState(120);
  const [topK, setTopK] = useState(5);
  const [minScore, setMinScore] = useState(0);

  useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setChunkSize(800);
      setChunkOverlap(120);
      setTopK(5);
      setMinScore(0);
    }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    onSubmit({ name: name.trim(), description: description.trim(), chunkSize, chunkOverlap, topK, minScore });
  }

  return (
    <Modal open={open} title="创建知识库" description="建议一个业务主题对应一个知识库。切片和召回参数可以先使用默认值，后续在设置中调整。" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="名称">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：客服知识库" required maxLength={160} />
        </Field>
        <Field label="描述">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="说明该知识库的业务范围" maxLength={2000} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
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
        <ErrorMessage error={error} />
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            <Plus className="h-4 w-4" />
            {pending ? "创建中..." : "创建并进入"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
