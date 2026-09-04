import { Plus } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Button, ErrorMessage, Field, Input, Modal, Textarea } from "../../components/ui";
import type { KnowledgeBaseResponse, SupportTicketPriority, SupportTicketRequest } from "../../types";
import { priorityLabels, priorityOptions } from "./constants";
import { Select } from "./shared";
export function CreateTicketModal({
  open,
  knowledgeBases,
  pending,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  knowledgeBases: KnowledgeBaseResponse[];
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (payload: SupportTicketRequest) => void;
}) {
  const [knowledgeBaseId, setKnowledgeBaseId] = useState("");
  const [category, setCategory] = useState("退货退款");
  const [channel, setChannel] = useState("在线客服");
  const [customerName, setCustomerName] = useState("");
  const [customerTier, setCustomerTier] = useState("");
  const [customerContact, setCustomerContact] = useState("");
  const [orderNo, setOrderNo] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [productName, setProductName] = useState("");
  const [productSku, setProductSku] = useState("");
  const [priority, setPriority] = useState<SupportTicketPriority>("NORMAL");
  const [issueSummary, setIssueSummary] = useState("");
  const [customerQuestion, setCustomerQuestion] = useState("");

  useEffect(() => {
    if (open && !knowledgeBaseId && knowledgeBases[0]) {
      setKnowledgeBaseId(knowledgeBases[0].id);
    }
  }, [knowledgeBaseId, knowledgeBases, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      knowledgeBaseId,
      status: "OPEN",
      priority,
      category,
      channel,
      customerName,
      customerTier,
      customerContact,
      orderNo,
      orderStatus,
      productName,
      productSku,
      issueSummary,
      customerQuestion
    });
  }

  return (
    <Modal open={open} title="新建工单" description="先填写客户问题；订单和商品信息可以稍后补充。" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="绑定知识库">
          <Select value={knowledgeBaseId} onChange={setKnowledgeBaseId}>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="客户">
            <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required maxLength={120} />
          </Field>
          <Field label="优先级">
            <Select value={priority} onChange={(value) => setPriority(value as SupportTicketPriority)}>
              {priorityOptions.filter(Boolean).map((item) => (
                <option key={item} value={item}>
                  {priorityLabels[item as SupportTicketPriority]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="分类">
            <Input value={category} onChange={(event) => setCategory(event.target.value)} required maxLength={80} />
          </Field>
          <Field label="渠道">
            <Input value={channel} onChange={(event) => setChannel(event.target.value)} required maxLength={40} />
          </Field>
        </div>
        <Field label="问题摘要">
          <Input value={issueSummary} onChange={(event) => setIssueSummary(event.target.value)} required maxLength={300} />
        </Field>
        <Field label="客户原问题">
          <Textarea value={customerQuestion} onChange={(event) => setCustomerQuestion(event.target.value)} required />
        </Field>

        <details className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-700">补充客户、订单和商品</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="客户层级">
              <Input value={customerTier} onChange={(event) => setCustomerTier(event.target.value)} maxLength={40} />
            </Field>
            <Field label="联系方式">
              <Input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} maxLength={160} />
            </Field>
            <Field label="订单号">
              <Input value={orderNo} onChange={(event) => setOrderNo(event.target.value)} maxLength={80} />
            </Field>
            <Field label="订单状态">
              <Input value={orderStatus} onChange={(event) => setOrderStatus(event.target.value)} maxLength={80} />
            </Field>
            <Field label="商品">
              <Input value={productName} onChange={(event) => setProductName(event.target.value)} maxLength={160} />
            </Field>
            <Field label="SKU">
              <Input value={productSku} onChange={(event) => setProductSku(event.target.value)} maxLength={80} />
            </Field>
          </div>
        </details>

        <ErrorMessage error={error} />
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" disabled={pending || !knowledgeBaseId || !customerName.trim() || !issueSummary.trim() || !customerQuestion.trim()}>
            <Plus className="h-4 w-4" />
            {pending ? "创建中" : "创建工单"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

