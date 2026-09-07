package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.chat.ChatService;
import com.example.rag.common.PageRequestParams;
import com.example.rag.domain.*;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.*;
import com.example.rag.support.SupportTicketService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class SupportTicketServicePermissionTest {
    @AfterEach
    void cleanup() { clearContext(); }

    @ParameterizedTest
    @CsvSource({"USER,VIEWER,false", "USER,EDITOR,true", "USER,MANAGER,true", "ADMIN,VIEWER,true"})
    void listAndStatisticsUseMaintainableKnowledgeBases(String role, KbPermission permission, boolean allowed) {
        TestSecurity.login(10L, 1L, "user@example.com", "User", role);
        var kbMapper = mock(KnowledgeBaseMapper.class);
        var members = mock(KnowledgeBaseMemberMapper.class);
        var users = mock(UserMapper.class);
        var audit = mock(AuditLogService.class);
        var tickets = mock(SupportTicketMapper.class);
        var issues = mock(KnowledgeIssueMapper.class);
        var kb = new KnowledgeBase();
        kb.setId(100L);
        kb.setTenantId(1L);
        kb.setOwnerId(99L);
        when(kbMapper.selectVisibleByTenantId(1L)).thenReturn(List.of(kb));
        when(members.countByKnowledgeBaseIdAndUserId(100L, 10L)).thenReturn(1);
        var member = new KnowledgeBaseMember();
        member.setPermission(permission);
        when(members.selectByKnowledgeBaseIdAndUserId(100L, 10L)).thenReturn(member);
        var service = new SupportTicketService(tickets, mock(SupportTicketEventMapper.class), kbMapper,
                issues, users, new KnowledgeBaseService(kbMapper, members, users, audit), mock(ChatService.class), audit);
        List<Long> scope = allowed ? List.of(100L) : List.of();
        service.list(null, null, null, false, false, PageRequestParams.of(1, 20, ""));
        verify(tickets).countByTenantId(1L, scope, null, "", "", null, false, "");
        verify(tickets).selectPageByTenantId(1L, scope, null, "", "", null, false, "", 20, 0);
        service.getStats(7);
        verify(tickets, times(2)).selectStatsByTenantId(eq(1L), eq(scope), any(), any());
        verify(tickets, times(2)).selectEventStatsByTenantId(eq(1L), eq(scope), any(), any());
        verify(tickets).selectCategoryBucketsByTenantId(eq(1L), eq(scope), any(), any(), eq(5));
        verify(tickets).selectChannelBucketsByTenantId(eq(1L), eq(scope), any(), any(), eq(5));
        verify(tickets).selectPriorityBucketsByTenantId(eq(1L), eq(scope), any(), any());
        verify(tickets).selectTrendByTenantId(eq(1L), eq(scope), any(), any());
        verify(tickets).selectAgentStatsByTenantId(eq(1L), eq(scope), any(), any(), eq(5));
        verify(issues).selectSupportTicketIssueStats(eq(1L), eq(scope), any(), any());
        verify(issues).selectSupportTicketNoAnswerRank(eq(1L), eq(scope), any(), any(), eq(5));
    }
}
