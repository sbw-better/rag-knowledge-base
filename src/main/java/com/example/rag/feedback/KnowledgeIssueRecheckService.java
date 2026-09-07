package com.example.rag.feedback;

import com.baomidou.mybatisplus.core.toolkit.IdWorker;
import com.example.rag.audit.AuditLogService;
import com.example.rag.domain.*;
import com.example.rag.feedback.dto.KnowledgeIssueRecheckResponse;
import com.example.rag.mapper.*;
import com.example.rag.retrieval.SearchService;
import com.example.rag.retrieval.dto.SearchMode;
import com.example.rag.retrieval.dto.SearchRequest;
import org.springframework.stereotype.Service;
import java.time.Instant;

@Service
public class KnowledgeIssueRecheckService {
    private final SearchService search;
    private final KnowledgeIssueRecheckMapper records;
    private final SupportTicketMapper tickets;
    private final SupportTicketEventMapper events;
    private final AuditLogService audit;

    public KnowledgeIssueRecheckService(SearchService search, KnowledgeIssueRecheckMapper records,
            SupportTicketMapper tickets, SupportTicketEventMapper events, AuditLogService audit) {
        this.search = search;
        this.records = records;
        this.tickets = tickets;
        this.events = events;
        this.audit = audit;
    }

    public KnowledgeIssueRecheckResponse run(KnowledgeIssue issue, UserAccount user) {
        String outcome;
        String summary;
        int count = 0;
        try {
            var hits = search.search(new SearchRequest(issue.getKnowledgeBaseId().toString(),
                    issue.getQuestion(), SearchMode.HYBRID, null)).hits();
            count = hits.size();
            outcome = count == 0 ? "NO_CONTEXT" : "CONTEXT_FOUND";
            summary = count == 0 ? "原问题仍未召回资料，请补充知识或检查索引后再次复检。"
                    : "原问题已召回 " + count + " 个片段，来源：" +
                    String.join("、", hits.stream().map(h -> h.fileName()).distinct().limit(3).toList())
                    + "。召回资料不代表答案质量已通过，请人工确认。";
        } catch (RuntimeException ex) {
            outcome = "FAILED";
            summary = "检索服务暂不可用，本次复检失败，请稍后重试。";
        }
        if (summary.length() > 2000) summary = summary.substring(0, 2000);
        var record = new KnowledgeIssueRecheckResponse(IdWorker.getIdStr(), issue.getId().toString(),
                user.getId().toString(), outcome, summary, count, Instant.now());
        records.insert(user.getTenantId(), record);
        audit.record(user, "KNOWLEDGE_ISSUE_RECHECK", "KNOWLEDGE_ISSUE", issue.getId(), summary);
        appendTicketEvent(issue, user, record);
        return record;
    }

    private void appendTicketEvent(KnowledgeIssue issue, UserAccount user, KnowledgeIssueRecheckResponse record) {
        if (!"SUPPORT_TICKET".equals(issue.getBusinessModule()) || issue.getBusinessEntityId() == null) return;
        Long ticketId;
        try {
            ticketId = Long.valueOf(issue.getBusinessEntityId());
        } catch (NumberFormatException ex) {
            return;
        }
        var ticket = tickets.selectByIdAndTenantId(ticketId, user.getTenantId());
        if (ticket == null || !issue.getKnowledgeBaseId().equals(ticket.getKnowledgeBaseId())) return;
        var event = new SupportTicketEvent();
        event.setTenantId(user.getTenantId());
        event.setTicketId(ticketId);
        event.setActorId(user.getId());
        event.setEventType(SupportTicketEventType.KNOWLEDGE_RECHECK);
        event.setNote("知识缺口 " + issue.getId() + "；复检 " + record.id() + "：" + record.summary());
        event.setCreatedAt(record.createdAt());
        events.insert(event);
    }
}
