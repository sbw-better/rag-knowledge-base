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
import com.example.rag.chat.dto.ChatResponse;
import com.example.rag.chat.dto.Citation;
import com.example.rag.chat.dto.ConversationResponse;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * RAG 问答应用服务。
 *
 * <p>一次问答会完成：权限校验、会话创建或加载、用户消息入库、混合检索、
 * Prompt 构建、LLM 调用、助手消息入库、引用来源保存。该类是在线问答链路的核心。</p>
 */
@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

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
        List<SearchCandidate> hits = searchService.searchInternal(kb, request.question(), SearchMode.HYBRID, topK);
        String answer = llmClient.chat(promptBuilder.build(request.question(), hits));
        MessageEntity assistantMessage = saveMessage(conversation, MessageRole.ASSISTANT, answer, null);
        List<Citation> citations = saveCitations(assistantMessage, hits);

        conversation.setUpdatedAt(Instant.now());
        conversationMapper.updateById(conversation);
        log.info("Chat completed. tenantId={}, userId={}, knowledgeBaseId={}, conversationId={}, hits={}, citations={}, costMs={}",
                user.getTenantId(), user.getId(), kb.getId(), conversation.getId(),
                hits.size(), citations.size(), elapsedMs(startedAt));
        return new ChatResponse(
                conversation.getId().toString(),
                userMessage.getId().toString(),
                assistantMessage.getId().toString(),
                answer,
                citations);
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(Long id) {
        UserAccount user = CurrentUser.required();
        Conversation conversation = loadConversation(user, id);
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

    private Conversation loadConversation(UserAccount user, Long conversationId) {
        Conversation conversation = conversationMapper.selectByIdAndTenantIdAndUserId(
                conversationId, user.getTenantId(), user.getId());
        if (conversation == null) {
            throw new NotFoundException("Conversation not found");
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
        log.debug("Conversation created. conversationId={}, userId={}, knowledgeBaseId={}",
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
                log.warn("Skip missing citation target. documentId={}, chunkId={}", hit.documentId(), hit.chunkId());
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

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
