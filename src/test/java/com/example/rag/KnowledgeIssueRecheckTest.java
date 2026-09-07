package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.domain.*;
import com.example.rag.feedback.KnowledgeIssueRecheckService;
import com.example.rag.mapper.*;
import com.example.rag.retrieval.SearchService;
import com.example.rag.retrieval.dto.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class KnowledgeIssueRecheckTest {
    private final SearchService search = mock(SearchService.class);
    private final KnowledgeIssueRecheckMapper records = mock(KnowledgeIssueRecheckMapper.class);
    private final SupportTicketMapper tickets = mock(SupportTicketMapper.class);
    private final SupportTicketEventMapper events = mock(SupportTicketEventMapper.class);
    private final KnowledgeIssueRecheckService service = new KnowledgeIssueRecheckService(
            search, records, tickets, events, mock(AuditLogService.class));

    @Test
    void foundContextPersistsHistoryAndLinksMatchingTicket() {
        var issue = issue();
        var ticket = new SupportTicket();
        ticket.setKnowledgeBaseId(20L);
        when(tickets.selectByIdAndTenantId(40L, 1L)).thenReturn(ticket);
        when(search.search(any())).thenReturn(new SearchResponse(List.of(
                new SearchHit("1", "2", "售后政策", 0, "内容", 0.9, "VECTOR"))));
        var result = service.run(issue, user());
        assertThat(result.outcome()).isEqualTo("CONTEXT_FOUND");
        assertThat(result.hitCount()).isEqualTo(1);
        assertThat(result.summary()).contains("售后政策", "人工确认");
        verify(records).insert(1L, result);
        verify(events).insert(argThat((SupportTicketEvent event) ->
                event.getTicketId().equals(40L) && event.getNote().contains(result.id())
                        && event.getEventType() == SupportTicketEventType.KNOWLEDGE_RECHECK));
    }

    @Test
    void noContextIsRecordedWithoutClaimingSuccess() {
        when(search.search(any())).thenReturn(new SearchResponse(List.of()));
        var result = service.run(issue(), user());
        assertThat(result.outcome()).isEqualTo("NO_CONTEXT");
        assertThat(result.hitCount()).isZero();
        verify(records).insert(1L, result);
    }

    @Test
    void searchFailureIsRecordedWithoutExposingException() {
        when(search.search(any())).thenThrow(new RuntimeException("secret provider detail"));
        var result = service.run(issue(), user());
        assertThat(result.outcome()).isEqualTo("FAILED");
        assertThat(result.summary()).doesNotContain("secret");
        verify(records).insert(1L, result);
    }

    @Test
    void unrelatedKnowledgeBaseCannotReceiveTicketEvent() {
        var ticket = new SupportTicket();
        ticket.setKnowledgeBaseId(99L);
        when(tickets.selectByIdAndTenantId(40L, 1L)).thenReturn(ticket);
        when(search.search(any())).thenReturn(new SearchResponse(List.of()));
        service.run(issue(), user());
        verify(events, never()).insert(any(SupportTicketEvent.class));
    }

    static KnowledgeIssue issue() {
        var issue = new KnowledgeIssue();
        issue.setId(30L);
        issue.setTenantId(1L);
        issue.setKnowledgeBaseId(20L);
        issue.setBusinessModule("SUPPORT_TICKET");
        issue.setBusinessEntityId("40");
        issue.setQuestion("如何退货");
        return issue;
    }

    static UserAccount user() {
        var user = new UserAccount();
        user.setId(10L);
        user.setTenantId(1L);
        return user;
    }
}
