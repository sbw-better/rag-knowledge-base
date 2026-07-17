package com.example.rag.chat;

import com.example.rag.auth.CurrentUser;
import com.example.rag.common.Ids;
import com.example.rag.common.NotFoundException;
import com.example.rag.domain.Conversation;
import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.MessageCitation;
import com.example.rag.domain.MessageEntity;
import com.example.rag.domain.MessageRole;
import com.example.rag.domain.UserAccount;
import com.example.rag.chat.dto.ChatRequest;
import com.example.rag.chat.dto.ChatAnswerStatus;
import com.example.rag.chat.dto.ChatResponse;
import com.example.rag.chat.dto.Citation;
import com.example.rag.chat.dto.ConversationResponse;
import com.example.rag.chat.dto.ConversationSummaryResponse;
import com.example.rag.chat.dto.ConversationUpdateRequest;
import com.example.rag.chat.dto.MessageItem;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.ConversationMapper;
import com.example.rag.mapper.DocumentChunkMapper;
import com.example.rag.mapper.DocumentMapper;
import com.example.rag.mapper.MessageCitationMapper;
import com.example.rag.mapper.MessageMapper;
import com.example.rag.model.LlmClient;
import com.example.rag.retrieval.SearchCandidate;
import com.example.rag.retrieval.SearchService;
import com.example.rag.retrieval.dto.SearchMode;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * RAG 问答应用服务。
 *
 * <p>一次问答会完成：权限校验、会话创建或加载、用户消息入库、混合检索、
 * Prompt 构建、LLM 调用、助手消息入库、引用来源保存。该类是在线问答链路的核心。</p>
 */
@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);
    private static final String EMPTY_KB_ANSWER = "当前知识库还没有可用资料，暂时无法基于知识库回答。请联系知识库负责人上传并完成文档入库后再提问。";
    private static final String NO_CONTEXT_ANSWER = "当前知识库没有检索到与问题相关的资料，因此无法基于知识库给出可靠回答。你可以换个问法，或联系知识库负责人补充相关文档。";
    private final ExecutorService streamExecutor = Executors.newCachedThreadPool();

    private final KnowledgeBaseService knowledgeBaseService;
    private final SearchService searchService;
    private final PromptBuilder promptBuilder;
    private final LlmClient llmClient;
    private final ConversationMapper conversationMapper;
    private final MessageMapper messageMapper;
    private final MessageCitationMapper citationMapper;
    private final DocumentMapper documentMapper;
    private final DocumentChunkMapper chunkMapper;

    public ChatService(KnowledgeBaseService knowledgeBaseService,
                       SearchService searchService,
                       PromptBuilder promptBuilder,
                       LlmClient llmClient,
                       ConversationMapper conversationMapper,
                       MessageMapper messageMapper,
                       MessageCitationMapper citationMapper,
                       DocumentMapper documentMapper,
                       DocumentChunkMapper chunkMapper) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.searchService = searchService;
        this.promptBuilder = promptBuilder;
        this.llmClient = llmClient;
        this.conversationMapper = conversationMapper;
        this.messageMapper = messageMapper;
        this.citationMapper = citationMapper;
        this.documentMapper = documentMapper;
        this.chunkMapper = chunkMapper;
    }

    @PreDestroy
    void shutdownStreamExecutor() {
        streamExecutor.shutdownNow();
    }

    @Transactional
    public ChatResponse chat(ChatRequest request) {
        long startedAt = System.nanoTime();
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(Ids.parse(request.knowledgeBaseId(), "knowledgeBaseId"));
        Conversation conversation = request.conversationId() == null
                ? createConversation(user, kb, request.question())
                : loadConversation(user, Ids.parse(request.conversationId(), "conversationId"));

        MessageEntity userMessage = saveMessage(conversation, MessageRole.USER, request.question(), null);
        int topK = request.topK() == null ? kb.getTopK() : request.topK();
        if (chunkMapper.countByTenantIdAndKnowledgeBaseId(kb.getTenantId(), kb.getId()) == 0) {
            return finishWithoutModel(user, kb, conversation, userMessage, EMPTY_KB_ANSWER, ChatAnswerStatus.EMPTY_KB, startedAt);
        }

        List<SearchCandidate> hits = searchService.searchInternal(kb, request.question(), SearchMode.HYBRID, topK);
        if (hits.isEmpty()) {
            return finishWithoutModel(user, kb, conversation, userMessage, NO_CONTEXT_ANSWER, ChatAnswerStatus.NO_CONTEXT, startedAt);
        }

        String answer = normalizeAnswerStyle(llmClient.chat(promptBuilder.build(request.question(), hits)));
        ChatAnswerStatus answerStatus = answerIndicatesNoUsableContext(answer) ? ChatAnswerStatus.NO_CONTEXT : ChatAnswerStatus.ANSWERED;
        MessageEntity assistantMessage = saveMessage(conversation, MessageRole.ASSISTANT, answer, null);
        List<Citation> citations = answerStatus == ChatAnswerStatus.ANSWERED ? saveCitations(assistantMessage, hits) : List.of();

        conversation.setUpdatedAt(Instant.now());
        conversationMapper.updateById(conversation);
        log.info("问答完成。tenantId={}, userId={}, knowledgeBaseId={}, conversationId={}, status={}, hits={}, citations={}, costMs={}",
                user.getTenantId(), user.getId(), kb.getId(), conversation.getId(),
                answerStatus, hits.size(), citations.size(), elapsedMs(startedAt));
        return new ChatResponse(
                conversation.getId().toString(),
                userMessage.getId().toString(),
                assistantMessage.getId().toString(),
                answer,
                answerStatus,
                citations);
    }

    /**
     * 发起一次流式问答。
     *
     * <p>该方法仍然先完成权限校验、会话创建、用户消息入库和知识库检索；之后把模型输出通过
     * SSE 的 delta 事件逐段发送给前端。模型输出完成后，再保存助手消息和引用来源，并发送 done
     * 事件作为最终确认。</p>
     */
    public SseEmitter chatStream(ChatRequest request) {
        long startedAt = System.nanoTime();
        SseEmitter emitter = new SseEmitter(0L);
        try {
            PreparedChatStream prepared = prepareChatStream(request, startedAt);
            streamExecutor.execute(() -> runPreparedChatStream(prepared, emitter));
        } catch (Exception ex) {
            streamExecutor.execute(() -> completeStreamWithError(emitter, ex));
        }
        return emitter;
    }

    private PreparedChatStream prepareChatStream(ChatRequest request, long startedAt) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(Ids.parse(request.knowledgeBaseId(), "knowledgeBaseId"));
        Conversation conversation = request.conversationId() == null
                ? createConversation(user, kb, request.question())
                : loadConversation(user, Ids.parse(request.conversationId(), "conversationId"));

        MessageEntity userMessage = saveMessage(conversation, MessageRole.USER, request.question(), null);
        int topK = request.topK() == null ? kb.getTopK() : request.topK();
        if (chunkMapper.countByTenantIdAndKnowledgeBaseId(kb.getTenantId(), kb.getId()) == 0) {
            return new PreparedChatStream(user, kb, conversation, userMessage, request, List.of(),
                    EMPTY_KB_ANSWER, ChatAnswerStatus.EMPTY_KB, startedAt);
        }

        List<SearchCandidate> hits = searchService.searchInternal(kb, request.question(), SearchMode.HYBRID, topK);
        if (hits.isEmpty()) {
            return new PreparedChatStream(user, kb, conversation, userMessage, request, List.of(),
                    NO_CONTEXT_ANSWER, ChatAnswerStatus.NO_CONTEXT, startedAt);
        }
        return new PreparedChatStream(user, kb, conversation, userMessage, request, hits,
                null, ChatAnswerStatus.ANSWERED, startedAt);
    }

    private void runPreparedChatStream(PreparedChatStream prepared, SseEmitter emitter) {
        try {
            sendEvent(emitter, "meta", Map.of(
                    "conversationId", prepared.conversation().getId().toString(),
                    "userMessageId", prepared.userMessage().getId().toString(),
                    "answerStatus", prepared.status().name()));

            if (prepared.precomputedAnswer() != null) {
                ChatResponse response = finishWithoutModel(
                        prepared.user(),
                        prepared.kb(),
                        prepared.conversation(),
                        prepared.userMessage(),
                        prepared.precomputedAnswer(),
                        prepared.status(),
                        prepared.startedAt());
                sendEvent(emitter, "delta", Map.of("content", response.answer()));
                sendEvent(emitter, "done", response);
                emitter.complete();
                return;
            }

            StringBuilder answerBuilder = new StringBuilder();
            llmClient.chatStream(promptBuilder.build(prepared.request().question(), prepared.hits()), delta -> {
                answerBuilder.append(delta);
                sendEvent(emitter, "delta", Map.of("content", delta));
            });
            String answer = normalizeAnswerStyle(answerBuilder.toString());
            ChatResponse response = finishWithModel(prepared, answer);
            sendEvent(emitter, "done", response);
            emitter.complete();
        } catch (Exception ex) {
            completeStreamWithError(emitter, ex);
        }
    }

    private ChatResponse finishWithModel(PreparedChatStream prepared, String answer) {
        ChatAnswerStatus answerStatus = answerIndicatesNoUsableContext(answer) ? ChatAnswerStatus.NO_CONTEXT : ChatAnswerStatus.ANSWERED;
        MessageEntity assistantMessage = saveMessage(prepared.conversation(), MessageRole.ASSISTANT, answer, null);
        List<Citation> citations = answerStatus == ChatAnswerStatus.ANSWERED ? saveCitations(assistantMessage, prepared.hits()) : List.of();
        prepared.conversation().setUpdatedAt(Instant.now());
        conversationMapper.updateById(prepared.conversation());
        log.info("流式问答完成。tenantId={}, userId={}, knowledgeBaseId={}, conversationId={}, status={}, hits={}, citations={}, costMs={}",
                prepared.user().getTenantId(), prepared.user().getId(), prepared.kb().getId(), prepared.conversation().getId(),
                answerStatus, prepared.hits().size(), citations.size(), elapsedMs(prepared.startedAt()));
        return new ChatResponse(
                prepared.conversation().getId().toString(),
                prepared.userMessage().getId().toString(),
                assistantMessage.getId().toString(),
                answer,
                answerStatus,
                citations);
    }

    private void sendEvent(SseEmitter emitter, String name, Object data) {
        try {
            emitter.send(SseEmitter.event().name(name).data(data));
        } catch (IOException | IllegalStateException ex) {
            throw new ChatStreamException("SSE 消息发送失败", ex);
        }
    }

    private void completeStreamWithError(SseEmitter emitter, Exception ex) {
        log.warn("流式问答失败。error={}", ex.getMessage());
        try {
            sendEvent(emitter, "error", Map.of("message", ex.getMessage() == null ? "流式问答失败" : ex.getMessage()));
            emitter.complete();
        } catch (Exception ignored) {
            emitter.completeWithError(ex);
        }
    }

    private ChatResponse finishWithoutModel(UserAccount user,
                                            KnowledgeBase kb,
                                            Conversation conversation,
                                            MessageEntity userMessage,
                                            String answer,
                                            ChatAnswerStatus status,
                                            long startedAt) {
        MessageEntity assistantMessage = saveMessage(conversation, MessageRole.ASSISTANT, answer, null);
        conversation.setUpdatedAt(Instant.now());
        conversationMapper.updateById(conversation);
        log.info("问答未调用模型即完成。tenantId={}, userId={}, knowledgeBaseId={}, conversationId={}, status={}, costMs={}",
                user.getTenantId(), user.getId(), kb.getId(), conversation.getId(), status, elapsedMs(startedAt));
        return new ChatResponse(
                conversation.getId().toString(),
                userMessage.getId().toString(),
                assistantMessage.getId().toString(),
                answer,
                status,
                List.of());
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(Long id) {
        UserAccount user = CurrentUser.required();
        Conversation conversation = loadConversation(user, id);
        knowledgeBaseService.requireAccess(conversation.getKnowledgeBaseId());
        return toConversationResponse(conversation);
    }

    @Transactional(readOnly = true)
    public List<ConversationSummaryResponse> listConversations(Long knowledgeBaseId) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(knowledgeBaseId);
        return conversationMapper.selectByKnowledgeBaseId(user.getTenantId(), user.getId(), kb.getId(), 50)
                .stream()
                .map(this::toConversationSummary)
                .toList();
    }

    @Transactional
    public ConversationSummaryResponse renameConversation(Long id, ConversationUpdateRequest request) {
        UserAccount user = CurrentUser.required();
        Conversation conversation = loadConversation(user, id);
        knowledgeBaseService.requireAccess(conversation.getKnowledgeBaseId());
        conversation.setTitle(request.title().trim());
        conversation.setUpdatedAt(Instant.now());
        conversationMapper.updateById(conversation);
        log.info("会话已重命名。tenantId={}, userId={}, conversationId={}",
                user.getTenantId(), user.getId(), conversation.getId());
        return toConversationSummary(conversation);
    }

    @Transactional
    public void deleteConversation(Long id) {
        UserAccount user = CurrentUser.required();
        Conversation conversation = loadConversation(user, id);
        knowledgeBaseService.requireAccess(conversation.getKnowledgeBaseId());
        citationMapper.deleteByConversationId(conversation.getId());
        messageMapper.deleteByConversationId(conversation.getId());
        conversationMapper.deleteById(conversation.getId());
        log.info("会话已删除。tenantId={}, userId={}, conversationId={}",
                user.getTenantId(), user.getId(), conversation.getId());
    }

    /**
     * 查询当前用户在指定知识库中的最近一次会话。
     *
     * <p>前端刷新或重新进入问答页时会使用该方法恢复上下文。如果用户从未在该知识库提问，
     * 返回 {@code null}，前端展示空会话即可。</p>
     */
    @Transactional(readOnly = true)
    public ConversationResponse getLatestConversation(Long knowledgeBaseId) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(knowledgeBaseId);
        Conversation conversation = conversationMapper.selectLatestByKnowledgeBaseId(
                user.getTenantId(), user.getId(), kb.getId());
        if (conversation == null) {
            return null;
        }
        return toConversationResponse(conversation);
    }

    private ConversationResponse toConversationResponse(Conversation conversation) {
        List<MessageItem> messages = messageMapper.selectByConversationIdOrderByCreatedAtAsc(conversation.getId())
                .stream()
                .map(message -> new MessageItem(
                        message.getId().toString(),
                        message.getRole().name(),
                        message.getContent(),
                        message.getCreatedAt(),
                        citationMapper.selectByMessageId(message.getId()).stream().map(this::toCitation).toList()))
                .toList();
        return new ConversationResponse(conversation.getId().toString(), conversation.getTitle(), messages);
    }

    private ConversationSummaryResponse toConversationSummary(Conversation conversation) {
        return new ConversationSummaryResponse(
                conversation.getId().toString(),
                conversation.getTitle(),
                conversation.getCreatedAt(),
                conversation.getUpdatedAt());
    }

    private Conversation loadConversation(UserAccount user, Long conversationId) {
        Conversation conversation = conversationMapper.selectByIdAndTenantIdAndUserId(
                conversationId, user.getTenantId(), user.getId());
        if (conversation == null) {
            throw new NotFoundException("会话不存在");
        }
        return conversation;
    }

    private Conversation createConversation(UserAccount user, KnowledgeBase kb, String question) {
        Conversation conversation = new Conversation();
        conversation.setTenantId(user.getTenantId());
        conversation.setUserId(user.getId());
        conversation.setKnowledgeBaseId(kb.getId());
        conversation.setTitle(question.length() > 80 ? question.substring(0, 80) : question);
        conversationMapper.insert(conversation);
        log.debug("会话已创建。conversationId={}, userId={}, knowledgeBaseId={}",
                conversation.getId(), user.getId(), kb.getId());
        return conversation;
    }

    private MessageEntity saveMessage(Conversation conversation, MessageRole role, String content, String metadataJson) {
        MessageEntity message = new MessageEntity();
        message.setConversationId(conversation.getId());
        message.setRole(role);
        message.setContent(content);
        message.setMetadataJson(metadataJson);
        messageMapper.insert(message);
        return message;
    }

    private List<Citation> saveCitations(MessageEntity message, List<SearchCandidate> hits) {
        List<Citation> citations = new ArrayList<>();
        for (SearchCandidate hit : hits) {
            DocumentEntity document = documentMapper.selectById(hit.documentId());
            DocumentChunk chunk = chunkMapper.selectChunkById(hit.chunkId());
            if (document == null || chunk == null) {
                log.warn("跳过缺失的引用目标。documentId={}, chunkId={}", hit.documentId(), hit.chunkId());
                continue;
            }
            MessageCitation citation = new MessageCitation();
            citation.setMessageId(message.getId());
            citation.setDocumentId(document.getId());
            citation.setChunkId(chunk.getId());
            citation.setFileName(hit.fileName());
            citation.setChunkIndex(hit.chunkIndex());
            citation.setScore(hit.score());
            citation.setSnippet(snippet(hit.content()));
            citationMapper.insert(citation);
            citations.add(toCitation(citation));
        }
        return citations;
    }

    private Citation toCitation(MessageCitation citation) {
        return new Citation(
                citation.getDocumentId().toString(),
                citation.getChunkId().toString(),
                citation.getFileName(),
                citation.getChunkIndex(),
                citation.getScore(),
                citation.getSnippet());
    }

    private static String snippet(String content) {
        String value = content == null ? "" : content.trim();
        return value.length() <= 300 ? value : value.substring(0, 300);
    }

    /**
     * 移除模型常见的机械式开头，让回答更像直接面向业务用户。
     *
     * <p>这里仅处理非常明确的固定套话，不改写事实内容；引用来源仍由 citations 字段单独返回。</p>
     */
    private static String normalizeAnswerStyle(String answer) {
        if (answer == null) {
            return "";
        }
        String value = answer.stripLeading();
        String[] prefixes = {
                "根据提供的资料，",
                "根据提供的资料,",
                "根据提供的上下文，",
                "根据提供的上下文,",
                "根据上下文，",
                "根据上下文,",
                "根据知识库资料，",
                "根据知识库资料,",
                "根据当前知识库资料，",
                "根据当前知识库资料,"
        };
        for (String prefix : prefixes) {
            if (value.startsWith(prefix)) {
                return value.substring(prefix.length()).stripLeading();
            }
        }
        return value;
    }

    /**
     * 判断模型是否已经明确表示“知识库资料不足以回答”。
     *
     * <p>向量检索只代表找到了相对相似的片段，不代表片段真的能回答问题。比如用户问“我叫啥”，
     * 检索可能召回健康指南或接口文档，但模型会判断资料没有覆盖姓名信息。此时如果仍展示引用，
     * 用户会误以为这些文件支撑了答案，所以这里把它归为 NO_CONTEXT，并清空引用来源。</p>
     */
    private static boolean answerIndicatesNoUsableContext(String answer) {
        String value = answer == null ? "" : answer.strip().toLowerCase();
        if (value.isBlank()) {
            return true;
        }
        String[] phrases = {
                "当前资料没有覆盖",
                "资料没有覆盖",
                "知识库没有覆盖",
                "当前知识库没有覆盖",
                "当前资料中没有",
                "资料中没有",
                "知识库中没有",
                "没有检索到",
                "没有找到相关资料",
                "没有相关资料",
                "无法基于知识库",
                "无法根据当前资料",
                "无法从当前资料",
                "context 不足",
                "context不足"
        };
        for (String phrase : phrases) {
            if (value.contains(phrase)) {
                return true;
            }
        }
        return false;
    }

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }

    private record PreparedChatStream(UserAccount user,
                                      KnowledgeBase kb,
                                      Conversation conversation,
                                      MessageEntity userMessage,
                                      ChatRequest request,
                                      List<SearchCandidate> hits,
                                      String precomputedAnswer,
                                      ChatAnswerStatus status,
                                      long startedAt) {
    }

    private static class ChatStreamException extends RuntimeException {
        ChatStreamException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
