import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageSquare, Search, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, EmptyState, ErrorMessage, Input, Pagination, Panel, PanelHeader } from "../../components/ui";
import { api } from "../../lib/api";
import { cn, formatDateTime, shortId } from "../../lib/utils";
import type { Citation, ChatResponse, ConversationSummaryResponse, FeedbackRating, MessageItem } from "../../types";

const CONVERSATION_PAGE_SIZE = 10;

type ChatItem = {
  id?: string;
  userMessageId?: string;
  role: "user" | "assistant";
  content: string;
  answerStatus?: ChatResponse["answerStatus"];
  citations?: Citation[];
  streaming?: boolean;
  feedbackRating?: FeedbackRating;
  feedbackPending?: boolean;
};

export function ChatPanel({ kbId, defaultTopK }: { kbId: string; defaultTopK: number }) {
  const queryClient = useQueryClient();
  const streamAbortRef = useRef<AbortController | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(() => readStoredConversationId(kbId));
  const [skipRestore, setSkipRestore] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | undefined>();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [historyPage, setHistoryPage] = useState(1);

  const conversationQuery = useQuery({
    queryKey: ["chat-conversation", kbId, conversationId ?? "latest"],
    queryFn: () => (conversationId ? api.getConversation(conversationId) : api.getLatestConversation(kbId)),
    enabled: !skipRestore,
    retry: false
  });

  const conversationsQuery = useQuery({
    queryKey: ["chat-conversations", kbId, historyPage, CONVERSATION_PAGE_SIZE, historyKeyword],
    queryFn: () => api.listConversationsPage(kbId, { page: historyPage, pageSize: CONVERSATION_PAGE_SIZE, keyword: historyKeyword }),
    enabled: Boolean(kbId)
  });

  useEffect(() => {
    setConversationId(readStoredConversationId(kbId));
    setMessages([]);
    setSelectedAssistantId(undefined);
    setQuestion("");
    setHistoryOpen(false);
    setHistoryKeyword("");
    setHistoryPage(1);
    setSkipRestore(false);
  }, [kbId]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyKeyword]);

  useEffect(() => {
    const totalPages = conversationsQuery.data?.totalPages ?? 1;
    if (historyPage > totalPages) {
      setHistoryPage(totalPages);
    }
  }, [conversationsQuery.data?.totalPages, historyPage]);

  useEffect(() => {
    if (!conversationQuery.isSuccess) {
      return;
    }
    const conversation = conversationQuery.data;
    if (!conversation) {
      if (!conversationId) {
        setMessages([]);
      }
      return;
    }
    setConversationId(conversation.id);
    storeConversationId(kbId, conversation.id);
    const restoredMessages = conversation.messages.map(toChatItem);
    setMessages(restoredMessages);
    setSelectedAssistantId(findLatestAssistantId(restoredMessages));
  }, [conversationQuery.data, conversationQuery.isSuccess, conversationId, kbId]);

  useEffect(() => {
    if (!conversationQuery.isError || !conversationId) {
      return;
    }
    removeStoredConversationId(kbId);
    setConversationId(undefined);
    setMessages([]);
    setSelectedAssistantId(undefined);
  }, [conversationId, conversationQuery.isError, kbId]);

  const chatMutation = useMutation({
    mutationFn: async (currentQuestion: string) => {
      const assistantTempId = `stream-${Date.now()}`;
      const controller = new AbortController();
      let doneReceived = false;
      let streamStarted = false;
      streamAbortRef.current = controller;
      setMessages((current) => [...current, { id: assistantTempId, role: "assistant", content: "", citations: [], streaming: true }]);
      try {
        await api.streamChat(
          { knowledgeBaseId: kbId, conversationId, question: currentQuestion, topK: defaultTopK },
          {
            onMeta: (data) => {
              streamStarted = true;
              setConversationId(data.conversationId);
              storeConversationId(kbId, data.conversationId);
            },
            onDelta: (content) => {
              if (!content) {
                return;
              }
              setMessages((current) =>
                current.map((item) => item.id === assistantTempId ? { ...item, content: `${item.content}${content}` } : item)
              );
            },
            onDone: (data: ChatResponse) => {
              doneReceived = true;
              setConversationId(data.conversationId);
              storeConversationId(kbId, data.conversationId);
              setSelectedAssistantId(data.assistantMessageId);
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantTempId
                    ? {
                        id: data.assistantMessageId,
                        role: "assistant",
                        userMessageId: data.userMessageId,
                        content: data.answer,
                        answerStatus: data.answerStatus,
                        citations: data.citations,
                        streaming: false
                      }
                    : item
                )
              );
            }
          },
          controller.signal
        );
        if (!doneReceived) {
          throw new Error("流式回答没有正常结束，请稍后重试。");
        }
      } catch (error) {
        let finalError = error;
        if (!streamStarted && !controller.signal.aborted) {
          try {
            let data: ChatResponse;
            try {
              data = await api.chat({ knowledgeBaseId: kbId, conversationId, question: currentQuestion, topK: defaultTopK });
            } catch (fallbackError) {
              if (conversationId && isStaleConversationError(fallbackError)) {
                removeStoredConversationId(kbId);
                setConversationId(undefined);
                data = await api.chat({ knowledgeBaseId: kbId, question: currentQuestion, topK: defaultTopK });
              } else {
                throw fallbackError;
              }
            }
            setConversationId(data.conversationId);
            storeConversationId(kbId, data.conversationId);
            setSelectedAssistantId(data.assistantMessageId);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantTempId
                  ? {
                      id: data.assistantMessageId,
                      role: "assistant",
                      userMessageId: data.userMessageId,
                      content: data.answer,
                      answerStatus: data.answerStatus,
                      citations: data.citations,
                      streaming: false
                    }
                  : item
              )
            );
            return;
          } catch (fallbackError) {
            finalError = fallbackError;
          }
        }
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantTempId
              ? { ...item, content: item.content || "回答生成失败，请稍后重试。", streaming: false }
            : item
          )
        );
        throw finalError;
      } finally {
        streamAbortRef.current = null;
        setSkipRestore(false);
      }
    },
    onSuccess: () => {
      setQuestion("");
      queryClient.invalidateQueries({ queryKey: ["chat-conversations", kbId] });
    }
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({ message, rating, comment }: { message: ChatItem; rating: FeedbackRating; comment?: string }) => {
      if (!message.id) {
        throw new Error("回答还没有保存完成，请稍后再评价。");
      }
      const pairedUserMessage = findPreviousUserMessage(messages, message.id);
      setMessages((current) =>
        current.map((item) => item.id === message.id ? { ...item, feedbackPending: true } : item)
      );
      return api.submitAnswerFeedback({
        assistantMessageId: message.id,
        userMessageId: message.userMessageId,
        rating,
        reason: rating === "NOT_HELPFUL" ? "ANSWER_NEEDS_IMPROVEMENT" : undefined,
        comment,
        question: pairedUserMessage?.content
      });
    },
    onSuccess: (feedback) => {
      setMessages((current) =>
        current.map((item) =>
          item.id === feedback.assistantMessageId
            ? { ...item, feedbackRating: feedback.rating, feedbackPending: false }
            : item
        )
      );
      queryClient.invalidateQueries({ queryKey: ["knowledge-issues", kbId] });
    },
    onError: (_error, variables) => {
      setMessages((current) =>
        current.map((item) => item.id === variables.message.id ? { ...item, feedbackPending: false } : item)
      );
    }
  });

  const renameConversationMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.renameConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations", kbId] });
      queryClient.invalidateQueries({ queryKey: ["chat-conversation", kbId, conversationId ?? "latest"] });
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => api.deleteConversation(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["chat-conversations", kbId] });
      queryClient.removeQueries({ queryKey: ["chat-conversation", kbId, id] });
      if (conversationId === id) {
        resetConversation();
      }
    }
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      return;
    }
    setQuestion("");
    setSkipRestore(true);
    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    chatMutation.mutate(trimmed);
  }

  function resetConversation() {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    removeStoredConversationId(kbId);
    setConversationId(undefined);
    setMessages([]);
    setSelectedAssistantId(undefined);
    setQuestion("");
    setHistoryOpen(false);
    setHistoryKeyword("");
    setHistoryPage(1);
    setSkipRestore(true);
    chatMutation.reset();
    queryClient.removeQueries({ queryKey: ["chat-conversation", kbId] });
  }

  function switchConversation(nextConversationId: string) {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    chatMutation.reset();
    if (!nextConversationId) {
      resetConversation();
      return;
    }
    if (nextConversationId === conversationId) {
      setHistoryOpen(false);
      return;
    }
    setConversationId(nextConversationId);
    storeConversationId(kbId, nextConversationId);
    setMessages([]);
    setSelectedAssistantId(undefined);
    setHistoryOpen(false);
    setSkipRestore(false);
  }

  function renameConversation(conversation: ConversationSummaryResponse) {
    const currentTitle = conversation.title || `会话 ${shortId(conversation.id)}`;
    const nextTitle = window.prompt("请输入新的会话标题，便于后续在历史会话中搜索", currentTitle);
    if (nextTitle?.trim()) {
      renameConversationMutation.mutate({ id: conversation.id, title: nextTitle.trim() });
    }
  }

  function deleteConversation(conversation: ConversationSummaryResponse) {
    const title = conversation.title || `会话 ${shortId(conversation.id)}`;
    if (window.confirm(`确认删除会话「${title}」及其问答历史吗？删除后无法从前端恢复。`)) {
      deleteConversationMutation.mutate(conversation.id);
    }
  }

  function submitFeedback(message: ChatItem, rating: FeedbackRating) {
    if (!message.id || message.streaming || message.feedbackPending) {
      return;
    }
    let comment: string | undefined;
    if (rating === "NOT_HELPFUL") {
      const input = window.prompt("哪里不够好？可以简单写一句，后续会进入知识缺口处理。");
      if (input === null) {
        return;
      }
      comment = input.trim() || undefined;
    }
    feedbackMutation.mutate({ message, rating, comment });
  }

  const currentConversationTitle = conversationId
    ? conversationsQuery.data?.items.find((item) => item.id === conversationId)?.title ?? conversationQuery.data?.title ?? `会话 ${shortId(conversationId)}`
    : "新会话";
  const conversations = conversationsQuery.data?.items ?? [];
  const conversationTotal = conversationsQuery.data?.total ?? 0;
  const safeHistoryPage = conversationsQuery.data?.page ?? historyPage;

  const selectedAssistant = useMemo(
    () => messages.find((item) => item.role === "assistant" && item.id === selectedAssistantId)
      ?? [...messages].reverse().find((item) => item.role === "assistant"),
    [messages, selectedAssistantId]
  );
  const selectedCitations = selectedAssistant?.citations ?? [];

  function citationEmptyState() {
    if (!selectedAssistant) {
      return { title: "暂无引用", description: "选择一条回答后，这里会显示对应的来源片段。" };
    }
    if (selectedAssistant.answerStatus === "EMPTY_KB") {
      return { title: "知识库暂无资料", description: "当前知识库没有可引用的文档片段，请联系负责人上传并完成入库。" };
    }
    if (selectedAssistant.answerStatus === "NO_CONTEXT") {
      return { title: "这条回答未命中资料", description: "该问题没有检索到可引用片段，可以换个问法或补充相关文档。" };
    }
    return { title: "这条回答没有引用来源", description: "当前选中的回答没有返回可展示的来源片段。" };
  }

  const emptyCitationState = citationEmptyState();
  const isRestoringConversation = conversationQuery.isLoading && !skipRestore;
  const chatDescription = conversationId
    ? "本轮问答已开启，后续问题会延续当前上下文。"
    : "向当前知识库提问，回答会附带可核验的来源。";

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Panel className="min-w-0 min-h-[620px]">
        <PanelHeader
          title="知识库问答"
          description={chatDescription}
          actions={
            <div className="flex max-w-full flex-wrap items-center gap-2">
              <div className="relative">
                <Button type="button" variant="secondary" size="sm" onClick={() => setHistoryOpen((current) => !current)}>
                  <MessageSquare className="h-4 w-4" />
                  历史会话
                </Button>
                {historyOpen ? (
                  <div className="absolute right-0 top-10 z-20 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-950/10">
                    <div className="border-b border-slate-100 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">历史会话</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">当前：{currentConversationTitle}</p>
                        </div>
                        <button
                          type="button"
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label="关闭历史会话"
                          onClick={() => setHistoryOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="relative mt-3">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          className="h-9 pl-9 pr-9"
                          value={historyKeyword}
                          onChange={(event) => setHistoryKeyword(event.target.value)}
                          placeholder="搜索会话标题或编号"
                        />
                        {historyKeyword ? (
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="清空搜索"
                            onClick={() => setHistoryKeyword("")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {conversationsQuery.isLoading ? <p className="px-3 py-3 text-sm text-slate-500">正在加载会话...</p> : null}
                    {!conversationsQuery.isLoading && conversationTotal === 0 && !historyKeyword ? (
                      <p className="px-3 py-3 text-sm text-slate-500">暂无历史会话</p>
                    ) : null}
                    {!conversationsQuery.isLoading && conversationTotal === 0 && historyKeyword ? (
                      <p className="px-3 py-3 text-sm text-slate-500">没有找到匹配的会话</p>
                    ) : null}
                    <div className="max-h-72 overflow-y-auto p-2">
                      {conversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className={cn(
                            "flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition",
                            conversation.id === conversationId
                              ? "bg-emerald-50 text-emerald-800"
                              : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                          )}
                          onClick={() => switchConversation(conversation.id)}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{conversation.title || `会话 ${shortId(conversation.id)}`}</span>
                            <span className="mt-0.5 block text-xs text-slate-400">更新于 {formatDateTime(conversation.updatedAt)}</span>
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-white hover:text-slate-900"
                              disabled={renameConversationMutation.isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                renameConversation(conversation);
                              }}
                            >
                              编辑
                            </button>
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-xs text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
                              disabled={deleteConversationMutation.isPending}
                              onClick={(event) => {
                                event.stopPropagation();
                                deleteConversation(conversation);
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                    <Pagination
                      page={safeHistoryPage}
                      pageSize={CONVERSATION_PAGE_SIZE}
                      total={conversationTotal}
                      onPageChange={setHistoryPage}
                    />
                  </div>
                ) : null}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={resetConversation}>
                <MessageSquare className="h-4 w-4" />
                新建会话
              </Button>
            </div>
          }
        />
        <div className="flex h-[min(500px,calc(100vh-340px))] min-h-[420px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {isRestoringConversation ? <EmptyState title="正在恢复会话" description="正在加载你在当前知识库里的最近一次问答。" /> : null}
            {!isRestoringConversation && messages.length === 0 ? <EmptyState title="开始提问" description="可以直接描述你的问题，系统会从当前知识库中查找相关资料后回答。" /> : null}
            {messages.map((message, index) => (
              <div key={message.id ?? `${message.role}-${index}`} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  role={message.role === "assistant" ? "button" : undefined}
                  tabIndex={message.role === "assistant" ? 0 : undefined}
                  onClick={() => message.role === "assistant" && message.id ? setSelectedAssistantId(message.id) : undefined}
                  onKeyDown={(event) => {
                    if (message.role === "assistant" && message.id && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      setSelectedAssistantId(message.id);
                    }
                  }}
                  className={cn(
                    "max-w-[min(760px,90%)] rounded-lg px-4 py-3 text-left text-sm leading-6 transition",
                    message.role === "user" && "cursor-default bg-emerald-600 text-white",
                    message.role === "assistant" && "cursor-pointer",
                    message.role === "assistant" && "border bg-white text-slate-800 hover:border-cyan-200 hover:bg-cyan-50/20",
                    message.role === "assistant" && message.id === selectedAssistant?.id
                      ? "border-cyan-300 shadow-sm shadow-cyan-900/10"
                      : message.role === "assistant" && "border-slate-200"
                  )}
                >
                  {message.role === "assistant" ? (
                    <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-emerald-700">
                      <span className="inline-flex items-center gap-1">
                        <Bot className="h-3.5 w-3.5" />
                        知识库助手
                      </span>
                      {message.answerStatus === "EMPTY_KB" ? <Badge tone="amber">知识库暂无资料</Badge> : null}
                      {message.answerStatus === "NO_CONTEXT" ? <Badge tone="slate">未命中资料</Badge> : null}
                      {message.streaming ? <Badge tone="cyan">生成中</Badge> : null}
                    </div>
                  ) : null}
                    <p className="whitespace-pre-wrap break-words">{message.content || (message.streaming ? "正在检索并生成回答..." : "")}</p>
                  {message.citations?.length ? (
                    <span className="mt-3 inline-flex max-w-full items-center gap-1 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800">
                      <span>查看 {message.citations.length} 个来源</span>
                      <span className="min-w-0 truncate text-cyan-700">· {summarizeCitationFiles(message.citations)}</span>
                    </span>
                  ) : null}
                  {message.role === "assistant" && message.id && !message.streaming ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition",
                          message.feedbackRating === "HELPFUL"
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        )}
                        disabled={message.feedbackPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          submitFeedback(message, "HELPFUL");
                        }}
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        有用
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition",
                          message.feedbackRating === "NOT_HELPFUL"
                            ? "bg-amber-50 text-amber-700"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        )}
                        disabled={message.feedbackPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          submitFeedback(message, "NOT_HELPFUL");
                        }}
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        需补充
                      </button>
                      {message.feedbackPending ? <span className="text-xs text-slate-400">保存中...</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={submit} className="border-t border-slate-100 p-4">
            <ErrorMessage error={chatMutation.error} />
            <ErrorMessage error={feedbackMutation.error} />
            <ErrorMessage error={renameConversationMutation.error || deleteConversationMutation.error} />
            <div className="mt-3 flex items-center gap-3">
              <Input
                className="h-12 min-w-0 text-base sm:text-sm"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="向当前知识库提问"
              />
              <Button
                className="h-12 min-w-24 shrink-0 whitespace-nowrap px-5"
                type="submit"
                disabled={chatMutation.isPending || isRestoringConversation || !question.trim()}
              >
                <Send className="h-4 w-4" />
                发送
              </Button>
            </div>
          </form>
        </div>
      </Panel>

      <Panel className="h-fit min-w-0">
        <PanelHeader title="回答来源" description="显示当前选中回答引用的文档片段。" />
        <div className="space-y-3 p-5">
          {selectedAssistant ? (
            <div className="rounded-lg border border-cyan-100 bg-cyan-50/60 px-3 py-2 text-xs leading-5 text-cyan-800">
              当前查看：{selectedAssistant.content ? selectedAssistant.content.slice(0, 46) : "正在生成的回答"}
              {selectedAssistant.content.length > 46 ? "..." : ""}
            </div>
          ) : null}
          {selectedCitations.length === 0 ? <EmptyState title={emptyCitationState.title} description={emptyCitationState.description} /> : null}
          {selectedCitations.map((citation, index) => (
            <details key={`${citation.chunkId}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                来源 {index + 1} · {citation.fileName}
              </summary>
              <div className="mt-3 space-y-2 text-xs text-slate-500">
                <div>Chunk #{citation.chunkIndex} · Score {citation.score.toFixed(4)}</div>
                <p className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{citation.snippet}</p>
              </div>
            </details>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function chatConversationStorageKey(kbId: string) {
  return `ragkb.chat.conversation.${kbId}`;
}

function readStoredConversationId(kbId: string) {
  return window.localStorage.getItem(chatConversationStorageKey(kbId)) ?? undefined;
}

function storeConversationId(kbId: string, conversationId: string) {
  window.localStorage.setItem(chatConversationStorageKey(kbId), conversationId);
}

function removeStoredConversationId(kbId: string) {
  window.localStorage.removeItem(chatConversationStorageKey(kbId));
}

function isStaleConversationError(error: unknown) {
  const status = typeof error === "object" && error && "status" in error ? (error as { status?: number }).status : undefined;
  return status === 403 || status === 404;
}

function findLatestAssistantId(messages: ChatItem[]) {
  return [...messages].reverse().find((item) => item.role === "assistant")?.id;
}

function findPreviousUserMessage(messages: ChatItem[], assistantMessageId: string) {
  const assistantIndex = messages.findIndex((item) => item.id === assistantMessageId && item.role === "assistant");
  if (assistantIndex < 1) {
    return undefined;
  }
  for (let index = assistantIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messages[index];
    }
  }
  return undefined;
}

function toChatItem(message: MessageItem): ChatItem {
  return {
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content,
    citations: message.citations
  };
}

function summarizeCitationFiles(citations: Citation[]) {
  const files = Array.from(new Set(citations.map((citation) => citation.fileName).filter(Boolean)));
  if (files.length === 0) {
    return "查看来源";
  }
  if (files.length <= 2) {
    return files.join("、");
  }
  return `${files.slice(0, 2).join("、")} 等 ${files.length} 个文件`;
}
