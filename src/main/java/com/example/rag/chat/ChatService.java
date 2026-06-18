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
import com.example.rag.dto.ApiDtos;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.model.LlmClient;
import com.example.rag.repository.ConversationRepository;
import com.example.rag.repository.DocumentChunkRepository;
import com.example.rag.repository.DocumentRepository;
import com.example.rag.repository.MessageCitationRepository;
import com.example.rag.repository.MessageRepository;
import com.example.rag.retrieval.SearchCandidate;
import com.example.rag.retrieval.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatService {
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
    public ApiDtos.ChatResponse chat(ApiDtos.ChatRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(request.knowledgeBaseId());
        Conversation conversation = request.conversationId() == null
                ? createConversation(user, kb, request.question())
                : conversationRepository.findByIdAndTenant_IdAndUser_Id(request.conversationId(), user.getTenant().getId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));

        MessageEntity userMessage = saveMessage(conversation, MessageRole.USER, request.question(), null);
        int topK = request.topK() == null ? kb.getTopK() : request.topK();
        List<SearchCandidate> hits = searchService.searchInternal(kb, request.question(), ApiDtos.SearchMode.HYBRID, topK);
        String answer = llmClient.chat(promptBuilder.build(request.question(), hits));
        MessageEntity assistantMessage = saveMessage(conversation, MessageRole.ASSISTANT, answer, null);
        List<ApiDtos.Citation> citations = saveCitations(assistantMessage, hits);
        conversation.setUpdatedAt(Instant.now());
        return new ApiDtos.ChatResponse(conversation.getId(), userMessage.getId(), assistantMessage.getId(), answer, citations);
    }

    @Transactional(readOnly = true)
    public ApiDtos.ConversationResponse getConversation(UUID id) {
        UserAccount user = CurrentUser.required();
        Conversation conversation = conversationRepository.findByIdAndTenant_IdAndUser_Id(id, user.getTenant().getId(), user.getId())
                .orElseThrow(() -> new NotFoundException("Conversation not found"));
        List<ApiDtos.MessageItem> messages = messageRepository.findByConversation_IdOrderByCreatedAtAsc(conversation.getId())
                .stream()
                .map(message -> new ApiDtos.MessageItem(
                        message.getId(),
                        message.getRole().name(),
                        message.getContent(),
                        message.getCreatedAt(),
                        citationRepository.findByMessage_Id(message.getId()).stream().map(this::toCitation).toList()))
                .toList();
        return new ApiDtos.ConversationResponse(conversation.getId(), conversation.getTitle(), messages);
    }

    private Conversation createConversation(UserAccount user, KnowledgeBase kb, String question) {
        Conversation conversation = new Conversation();
        conversation.setTenant(user.getTenant());
        conversation.setUser(user);
        conversation.setKnowledgeBase(kb);
        conversation.setTitle(question.length() > 80 ? question.substring(0, 80) : question);
        return conversationRepository.save(conversation);
    }

    private MessageEntity saveMessage(Conversation conversation, MessageRole role, String content, String metadataJson) {
        MessageEntity message = new MessageEntity();
        message.setConversation(conversation);
        message.setRole(role);
        message.setContent(content);
        message.setMetadataJson(metadataJson);
        return messageRepository.save(message);
    }

    private List<ApiDtos.Citation> saveCitations(MessageEntity message, List<SearchCandidate> hits) {
        List<ApiDtos.Citation> citations = new ArrayList<>();
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

    private ApiDtos.Citation toCitation(MessageCitation citation) {
        return new ApiDtos.Citation(citation.getDocument().getId(), citation.getChunk().getId(),
                citation.getFileName(), citation.getChunkIndex(), citation.getScore(), citation.getSnippet());
    }

    private static String snippet(String content) {
        String value = content == null ? "" : content.trim();
        return value.length() <= 300 ? value : value.substring(0, 300);
    }
}
