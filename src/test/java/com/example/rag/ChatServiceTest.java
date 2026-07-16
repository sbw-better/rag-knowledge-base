package com.example.rag;

import com.example.rag.chat.ChatService;
import com.example.rag.chat.PromptBuilder;
import com.example.rag.chat.dto.ChatAnswerStatus;
import com.example.rag.chat.dto.ChatRequest;
import com.example.rag.chat.dto.ChatResponse;
import com.example.rag.domain.Conversation;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.MessageCitation;
import com.example.rag.domain.MessageEntity;
import com.example.rag.domain.UserAccount;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentMatchers;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ChatServiceTest {
    private final KnowledgeBaseService knowledgeBaseService = mock(KnowledgeBaseService.class);
    private final SearchService searchService = mock(SearchService.class);
    private final LlmClient llmClient = mock(LlmClient.class);
    private final ConversationMapper conversationMapper = mock(ConversationMapper.class);
    private final MessageMapper messageMapper = mock(MessageMapper.class);
    private final MessageCitationMapper citationMapper = mock(MessageCitationMapper.class);
    private final DocumentMapper documentMapper = mock(DocumentMapper.class);
    private final DocumentChunkMapper chunkMapper = mock(DocumentChunkMapper.class);

    private ChatService chatService;
    private KnowledgeBase kb;

    @BeforeEach
    void setUp() {
        UserAccount user = new UserAccount();
        user.setId(100L);
        user.setTenantId(1L);
        user.setEmail("user@example.com");
        user.setDisplayName("User");
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(user, null));

        kb = new KnowledgeBase();
        kb.setId(200L);
        kb.setTenantId(1L);
        kb.setOwnerId(100L);
        kb.setTopK(5);

        AtomicLong ids = new AtomicLong(1000L);
        doAnswer(invocation -> {
            Conversation conversation = invocation.getArgument(0);
            conversation.setId(ids.incrementAndGet());
            return 1;
        }).when(conversationMapper).insert(any(Conversation.class));
        doAnswer(invocation -> {
            MessageEntity message = invocation.getArgument(0);
            message.setId(ids.incrementAndGet());
            return 1;
        }).when(messageMapper).insert(any(MessageEntity.class));

        when(knowledgeBaseService.requireAccess(200L)).thenReturn(kb);
        chatService = new ChatService(
                knowledgeBaseService,
                searchService,
                new PromptBuilder(),
                llmClient,
                conversationMapper,
                messageMapper,
                citationMapper,
                documentMapper,
                chunkMapper);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void returnsEmptyKnowledgeBaseAnswerWithoutCallingModel() {
        when(chunkMapper.countByTenantIdAndKnowledgeBaseId(1L, 200L)).thenReturn(0);

        ChatResponse response = chatService.chat(new ChatRequest("200", null, "能回答什么？", null));

        assertThat(response.answerStatus()).isEqualTo(ChatAnswerStatus.EMPTY_KB);
        assertThat(response.answer()).contains("还没有可用资料");
        assertThat(response.citations()).isEmpty();
        verify(searchService, never()).searchInternal(any(), any(), any(), ArgumentMatchers.anyInt());
        verify(llmClient, never()).chat(any());
    }

    @Test
    void returnsNoContextAnswerWithoutCallingModelWhenSearchHasNoHits() {
        when(chunkMapper.countByTenantIdAndKnowledgeBaseId(1L, 200L)).thenReturn(3);
        when(searchService.searchInternal(eq(kb), eq("没有相关内容的问题"), eq(SearchMode.HYBRID), eq(5))).thenReturn(List.of());

        ChatResponse response = chatService.chat(new ChatRequest("200", null, "没有相关内容的问题", null));

        assertThat(response.answerStatus()).isEqualTo(ChatAnswerStatus.NO_CONTEXT);
        assertThat(response.answer()).contains("没有检索到与问题相关的资料");
        assertThat(response.citations()).isEmpty();
        verify(llmClient, never()).chat(any());
    }

    @Test
    void clearsCitationsWhenModelSaysContextDoesNotCoverQuestion() {
        SearchCandidate irrelevantHit = new SearchCandidate(
                300L,
                400L,
                "health-service-guide.md",
                1,
                "体检预约和报告解读相关说明",
                0.12,
                "VECTOR");
        when(chunkMapper.countByTenantIdAndKnowledgeBaseId(1L, 200L)).thenReturn(3);
        when(searchService.searchInternal(eq(kb), eq("我叫啥"), eq(SearchMode.HYBRID), eq(5))).thenReturn(List.of(irrelevantHit));
        when(llmClient.chat(any())).thenReturn("当前资料没有覆盖您的姓名信息。建议您补充相关资料或联系知识库负责人。");

        ChatResponse response = chatService.chat(new ChatRequest("200", null, "我叫啥", null));

        assertThat(response.answerStatus()).isEqualTo(ChatAnswerStatus.NO_CONTEXT);
        assertThat(response.citations()).isEmpty();
        verify(citationMapper, never()).insert(ArgumentMatchers.any(MessageCitation.class));
    }
}
