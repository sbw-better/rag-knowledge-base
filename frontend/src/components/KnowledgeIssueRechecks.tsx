import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatDateTime } from "../lib/utils";
import type { KnowledgeIssueResponse } from "../types";
import { Button, ErrorMessage } from "./ui";

const labels = { CONTEXT_FOUND: "已召回资料", NO_CONTEXT: "仍未命中", FAILED: "复检失败" };

export function KnowledgeIssueRechecks({ issue, canRecheck }: { issue: KnowledgeIssueResponse; canRecheck: boolean }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.recheckKnowledgeIssue(issue.id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["knowledge-issues"] });
      client.invalidateQueries({ queryKey: ["support-ticket-feedback-links"] });
      client.invalidateQueries({ queryKey: ["support-ticket-events"] });
    }
  });
  const records = issue.rechecks ?? [];
  const latest = records[0];
  return (
    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={latest?.outcome === "CONTEXT_FOUND" ? "font-medium text-emerald-700" : "font-medium text-amber-700"}>
          检索复检：{latest ? labels[latest.outcome] : "尚无记录"}
        </span>
        {canRecheck ? <Button type="button" size="sm" variant="secondary" disabled={mutation.isPending}
          onClick={() => mutation.mutate()}>{mutation.isPending ? "复检中..." : "重新复检"}</Button> : null}
      </div>
      <ErrorMessage error={mutation.error} />
      {latest ? <p className="break-words leading-5 text-slate-600">{latest.summary}</p>
        : <p className="text-slate-500">处理知识缺口后会自动检索原问题，并保存结果。</p>}
      {records.length > 0 ? (
        <details>
          <summary className="cursor-pointer text-slate-500">最近复检记录（{records.length}，最多显示 10 条）</summary>
          <ol className="mt-2 space-y-3 border-l border-slate-200 pl-3">
            {records.map(record => <li key={record.id}>
              <p className="text-slate-500">{formatDateTime(record.createdAt)} · {labels[record.outcome]} · 操作人 {record.actorId}</p>
              <p className="mt-1 break-words leading-5 text-slate-600">{record.summary}</p>
            </li>)}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
