package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.NotFoundException;
import com.example.rag.domain.KnowledgeIssueStatus;
import com.example.rag.feedback.*;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class KnowledgeFeedbackRecheckPermissionTest {
    private final KnowledgeBaseService knowledge = mock(KnowledgeBaseService.class);
    private final KnowledgeIssueMapper issues = mock(KnowledgeIssueMapper.class);
    private final KnowledgeIssueRecheckService rechecks = mock(KnowledgeIssueRecheckService.class);
    private final KnowledgeFeedbackService service = new KnowledgeFeedbackService(knowledge,
            mock(AnswerFeedbackMapper.class), issues, mock(MessageMapper.class), mock(ConversationMapper.class),
            mock(AuditLogService.class), rechecks, mock(KnowledgeIssueRecheckMapper.class));

    @AfterEach
    void cleanup() { clearContext(); }

    @Test
    void ticketBusinessLinksRequireContentManagementAccess() {
        TestSecurity.login(10L, 1L, "user@example.com", "User", "USER");
        when(knowledge.requireContentManageAccess(20L)).thenThrow(new ForbiddenException("无维护权限"));
        assertThatThrownBy(() -> service.listBusinessLinks(20L, "SUPPORT_TICKET", "40", 10))
                .isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(issues, rechecks);
    }

    @Test
    void crossTenantCannotRecheckOrResolve() {
        TestSecurity.login(10L, 2L, "user@example.com", "User", "ADMIN");
        when(issues.selectById(30L)).thenReturn(KnowledgeIssueRecheckTest.issue());
        assertThatThrownBy(() -> service.recheckIssue(30L)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.resolveIssue(30L, null)).isInstanceOf(NotFoundException.class);
        verifyNoInteractions(rechecks);
    }

    @Test
    void nonManagerCannotRecheckOrResolve() {
        TestSecurity.login(10L, 1L, "user@example.com", "User", "USER");
        when(issues.selectById(30L)).thenReturn(KnowledgeIssueRecheckTest.issue());
        when(knowledge.requireManageAccess(20L)).thenThrow(new ForbiddenException("无管理权限"));
        assertThatThrownBy(() -> service.recheckIssue(30L)).isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> service.resolveIssue(30L, null)).isInstanceOf(ForbiddenException.class);
        verifyNoInteractions(rechecks);
    }

    @Test
    void resolvingTriggersOneAutomaticRecheckAndExplicitRetryRemainsAvailable() {
        var user = TestSecurity.login(10L, 1L, "user@example.com", "User", "ADMIN");
        var issue = KnowledgeIssueRecheckTest.issue();
        issue.setStatus(KnowledgeIssueStatus.OPEN);
        when(issues.selectById(30L)).thenReturn(issue);
        service.resolveIssue(30L, null);
        service.resolveIssue(30L, null);
        verify(rechecks).run(issue, user);
        service.recheckIssue(30L);
        verify(rechecks, times(2)).run(issue, user);
    }
}
