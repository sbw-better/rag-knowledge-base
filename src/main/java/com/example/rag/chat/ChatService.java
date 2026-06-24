package com.example.rag.chat;

import com.example.rag.auth.CurrentUser;
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
import com.example.rag.model.LlmClient;
import com.example.rag.repository.ConversationRepository;
import com.example.rag.repository.DocumentChunkRepository;
import com.example.rag.repository.DocumentRepository;
import com.example.rag.repository.MessageCitationRepository;
import com.example.rag.repository.MessageRepository;
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
import java.util.UUID;

/**
 * RAG 问答应用服务。
 *
 * <p>一次问答会完成：权限校验、会话创建或加载、用户消息入库、混合检索、
 * Prompt 构建、LLM 调用、助手消息入库、引用来源保存。该类是在线问答链路的核心。</p>
 */
@Service
public class ChatService {
    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    public ChatService(KnowledgeBaseService knowledgeBaseService, SearchService searchService, PromptBuilder promptBuilder, LlmClient llmClient, ConversationRepository conversationRepository, MessageRepository messageRepository, MessageCitationRepository citationRepository, DocumentRepository documentRepository, DocumentChunkRepository chunkRepository) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.searchService = searchService;
        this.promptBuilder = promptBuilder;
        this.llmClient = llmClient;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.citationRepository = citationRepository;
        this.documentRepository = documentRepository;
        this.chunkRepository = chunkRepository;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final SearchService searchService;
    private final PromptBuilder promptBuilder;
    private final LlmClient llmClient;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final MessageCitationRepository citationRepository;
    private final DocumentRepository documentRepository;
    private final DocumentChunkRepository chunkRepository;

    @Transactional
    public ChatResponse chat(ChatRequest request) {
        long startedAt = System.nanoTime();
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(request.knowledgeBaseId());
        Conversation conversation = request.conversationId() == null
                ? createConversation(user, kb, request.question())
                : conversationRepository.findByIdAndTenant_IdAndUser_Id(request.conversationId(), user.getTenant().getId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        MessageEntity userMessage = saveMessage(conversation, MessageRole.USER, request.question(), null);
        int topK = request.topK() == null ? kb.getTopK() : request.topK();
        List<SearchCandidate> hits = searchService.searchInternal(kb, request.question(), SearchMode.HYBRID, topK);
        String answer = llmClient.chat(promptBuilder.build(request.question(), hits));
        MessageEntity assistantMessage = saveMessage(conversation, MessageRole.ASSISTANT, answer, null);
        List<Citation> citations = saveCitations(assistantMessage, hits);
        conversation.setUpdatedAt(Instant.now());
        log.info("Chat completed. tenantId={}, userId={}, knowledgeBaseId={}, conversationId={}, hits={}, citations={}, costMs={}",
                user.getTenant().getId(), user.getId(), kb.getId(), conversation.getId(),
                hits.size(), citations.size(), elapsedMs(startedAt));
        return new ChatResponse(conversation.getId(), userMessage.getId(), assistantMessage.getId(), answer, citations);
    }

    @Transactional(readOnly = true)
    public ConversationResponse getConversation(UUID id) {
        UserAccount user = CurrentUser.required();
        Conversation conversation = conversationRepository.findByIdAndTenant_IdAndUser_Id(id, user.getTenant().getId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        List<MessageItem> messages = messageRepository.findByConversation_IdOrderByCreatedAtAsc(conversation.getId())
                .stream()
                .map(message -> new MessageItem(
                        message.getId(),
                        message.getRole().name(),
                        message.getContent(),
                        message.getCreatedAt(),
                        citationRepository.findByMessage_Id(message.getId()).stream().map(this::toCitation).toList()))
                .toList();
        return new ConversationResponse(conversation.getId(), conversation.getTitle(), messages);
    }

    private Conversation createConversation(UserAccount user, KnowledgeBase kb, String question) {
        Conversation conversation = new Conversation();
        conversation.setTenant(user.getTenant());
        conversation.setUser(user);
        conversation.setKnowledgeBase(kb);
        conversation.setTitle(question.length() > 80 ? question.substring(0, 80) : question);
        Conversation saved = conversationRepository.save(conversation);
        log.debug("Conversation created. conversationId={}, userId={}, knowledgeBaseId={}",
                saved.getId(), user.getId(), kb.getId());
        return saved;
    }

    private MessageEntity saveMessage(Conversation conversation, MessageRole role, String content, String metadataJson) {
        MessageEntity message = new MessageEntity();
        message.setConversation(conversation);
        message.setRole(role);
        message.setContent(content);
        message.setMetadataJson(metadataJson);
        return messageRepository.save(message);
    }

    private List<Citation> saveCitations(MessageEntity message, List<SearchCandidate> hits) {
        List<Citation> citations = new ArrayList<>();
        for (SearchCandidate hit : hits) {
            DocumentEntity document = documentRepository.findById(hit.documentId()).orElseThrow();
            DocumentChunk chunk = chunkRepository.findById(hit.chunkId()).orElseThrow();
            MessageCitation citation = new MessageCitation();
            citation.setMessage(message);
            citation.setDocument(document);
            citation.setChunk(chunk);
            citation.setFileName(hit.fileName());
            citation.setChunkIndex(hit.chunkIndex());
            citation.setScore(hit.score());
            citation.setSnippet(snippet(hit.content()));
            citationRepository.save(citation);
            citations.add(toCitation(citation));
        }
        return citations;
    }

    private Citation toCitation(MessageCitation citation) {
        return new Citation(citation.getDocument().getId(), citation.getChunk().getId(),
                citation.getFileName(), citation.getChunkIndex(), citation.getScore(), citation.getSnippet());
    }

    private static String snippet(String content) {
        String value = content == null ? "" : content.trim();
        return value.length() <= 300 ? value : value.substring(0, 300);
    }

    private static long elapsedMs(long startedAt) {
        return (System.nanoTime() - startedAt) / 1_000_000;
    }
}
