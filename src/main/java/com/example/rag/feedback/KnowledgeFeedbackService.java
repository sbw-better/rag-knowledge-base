package com.example.rag.feedback;

import com.example.rag.audit.AuditLogService;
import com.example.rag.auth.CurrentUser;
import com.example.rag.chat.dto.ChatAnswerStatus;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.Ids;
import com.example.rag.common.NotFoundException;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.domain.AnswerFeedback;
import com.example.rag.domain.Conversation;
import com.example.rag.domain.FeedbackRating;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.KnowledgeIssue;
import com.example.rag.domain.KnowledgeIssueSource;
import com.example.rag.domain.KnowledgeIssueStatus;
import com.example.rag.domain.MessageEntity;
import com.example.rag.domain.MessageRole;
import com.example.rag.domain.UserAccount;
import com.example.rag.feedback.dto.AnswerFeedbackRequest;
import com.example.rag.feedback.dto.AnswerFeedbackResponse;
import com.example.rag.feedback.dto.KnowledgeIssueResponse;
import com.example.rag.feedback.dto.ResolveKnowledgeIssueRequest;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.AnswerFeedbackMapper;
import com.example.rag.mapper.ConversationMapper;
import com.example.rag.mapper.KnowledgeIssueMapper;
import com.example.rag.mapper.MessageMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * 知识问答反馈闭环服务。
 */
@Service
public class KnowledgeFeedbackService {
    private final KnowledgeBaseService knowledgeBaseService;
    private final AnswerFeedbackMapper answerFeedbackMapper;
    private final KnowledgeIssueMapper knowledgeIssueMapper;
    private final MessageMapper messageMapper;
    private final ConversationMapper conversationMapper;
    private final AuditLogService auditLogService;

    public KnowledgeFeedbackService(KnowledgeBaseService knowledgeBaseService,
                                    AnswerFeedbackMapper answerFeedbackMapper,
                                    KnowledgeIssueMapper knowledgeIssueMapper,
                                    MessageMapper messageMapper,
                                    ConversationMapper conversationMapper,
                                    AuditLogService auditLogService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.answerFeedbackMapper = answerFeedbackMapper;
        this.knowledgeIssueMapper = knowledgeIssueMapper;
        this.messageMapper = messageMapper;
        this.conversationMapper = conversationMapper;
        this.auditLogService = auditLogService;
    }

    @Transactional
    public AnswerFeedbackResponse submitFeedback(AnswerFeedbackRequest request) {
        UserAccount user = CurrentUser.required();
        Long assistantMessageId = Ids.parse(request.assistantMessageId(), "assistantMessageId");
        MessageEntity assistantMessage = messageMapper.selectById(assistantMessageId);
        if (assistantMessage == null || assistantMessage.getRole() != MessageRole.ASSISTANT) {
            throw new NotFoundException("回答消息不存在");
        }
        Conversation conversation = conversationMapper.selectById(assistantMessage.getConversationId());
        if (conversation == null
                || !user.getTenantId().equals(conversation.getTenantId())
                || !user.getId().equals(conversation.getUserId())) {
            throw new NotFoundException("会话不存在");
        }
        KnowledgeBase kb = knowledgeBaseService.requireAccess(conversation.getKnowledgeBaseId());
        MessageEntity userMessage = loadUserMessage(request.userMessageId(), conversation.getId());

        AnswerFeedback feedback = answerFeedbackMapper.selectByAssistantMessageIdAndUserId(assistantMessageId, user.getId());
        boolean createIssue = feedback == null || feedback.getRating() != FeedbackRating.NOT_HELPFUL;
        if (feedback == null) {
            feedback = new AnswerFeedback();
            feedback.setTenantId(user.getTenantId());
            feedback.setKnowledgeBaseId(kb.getId());
            feedback.setConversationId(conversation.getId());
            feedback.setAssistantMessageId(assistantMessage.getId());
            feedback.setUserId(user.getId());
            feedback.setCreatedAt(Instant.now());
        }
        feedback.setUserMessageId(userMessage == null ? null : userMessage.getId());
        feedback.setRating(request.rating());
        feedback.setReason(trimToNull(request.reason(), 80));
        feedback.setComment(trimToNull(request.comment(), 2000));
        feedback.setBusinessModule(trimToNull(request.businessModule(), 80));
        feedback.setBusinessEntityId(trimToNull(request.businessEntityId(), 120));

        if (feedback.getId() == null) {
            feedback.setUpdatedAt(feedback.getCreatedAt());
            answerFeedbackMapper.insert(feedback);
        } else {
            feedback.setUpdatedAt(Instant.now());
            answerFeedbackMapper.updateById(feedback);
        }

        if (request.rating() == FeedbackRating.NOT_HELPFUL && createIssue) {
            createIssue(user, kb, conversation, userMessage, assistantMessage, feedback,
                    KnowledgeIssueSource.NEGATIVE_FEEDBACK, request.question(), request.reason(),
                    request.comment(), request.businessModule(), request.businessEntityId());
        }
        auditLogService.record(user, "ANSWER_FEEDBACK_SUBMIT", "ANSWER_FEEDBACK", feedback.getId(),
                "提交回答反馈：" + request.rating());
        return toFeedbackResponse(feedback);
    }

    @Transactional
    public void recordNoContextIssue(UserAccount user,
                                     KnowledgeBase kb,
                                     Conversation conversation,
                                     MessageEntity userMessage,
                                     MessageEntity assistantMessage,
                                     ChatAnswerStatus status,
                                     String businessModule,
                                     String businessEntityId) {
        if (status != ChatAnswerStatus.EMPTY_KB && status != ChatAnswerStatus.NO_CONTEXT) {
            return;
        }
        createIssue(user, kb, conversation, userMessage, assistantMessage, null,
                KnowledgeIssueSource.NO_CONTEXT, userMessage.getContent(), status.name(), null, businessModule, businessEntityId);
    }

    @Transactional(readOnly = true)
    public PageResponse<KnowledgeIssueResponse> listIssues(Long knowledgeBaseId, String status, PageRequestParams params) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireManageAccess(knowledgeBaseId);
        String safeStatus = normalizeStatus(status);
        long total = knowledgeIssueMapper.countByKnowledgeBaseIdAndStatus(user.getTenantId(), kb.getId(), safeStatus, params.keyword());
        List<KnowledgeIssueResponse> items = knowledgeIssueMapper.selectPageByKnowledgeBaseIdAndStatus(
                        user.getTenantId(), kb.getId(), safeStatus, params.keyword(), params.pageSize(), params.offset())
                .stream()
                .map(this::toIssueResponse)
                .toList();
        return PageResponse.of(items, params.page(), params.pageSize(), total);
    }

    @Transactional
    public KnowledgeIssueResponse resolveIssue(Long issueId, ResolveKnowledgeIssueRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeIssue issue = knowledgeIssueMapper.selectById(issueId);
        if (issue == null || !user.getTenantId().equals(issue.getTenantId())) {
            throw new NotFoundException("知识缺口不存在");
        }
        knowledgeBaseService.requireManageAccess(issue.getKnowledgeBaseId());
        issue.setStatus(KnowledgeIssueStatus.RESOLVED);
        issue.setResolutionNote(trimToNull(request == null ? null : request.resolutionNote(), 2000));
        issue.setResolvedBy(user.getId());
        issue.setResolvedAt(Instant.now());
        issue.setUpdatedAt(Instant.now());
        knowledgeIssueMapper.updateById(issue);
        auditLogService.record(user, "KNOWLEDGE_ISSUE_RESOLVE", "KNOWLEDGE_ISSUE", issue.getId(),
                "处理知识缺口：" + issue.getQuestion());
        return toIssueResponse(issue);
    }

    private MessageEntity loadUserMessage(String userMessageId, Long conversationId) {
        if (userMessageId == null || userMessageId.isBlank()) {
            return null;
        }
        MessageEntity message = messageMapper.selectById(Ids.parse(userMessageId, "userMessageId"));
        if (message == null || message.getRole() != MessageRole.USER || !conversationId.equals(message.getConversationId())) {
            throw new BadRequestException("用户消息和当前回答不匹配");
        }
        return message;
    }

    private void createIssue(UserAccount user,
                             KnowledgeBase kb,
                             Conversation conversation,
                             MessageEntity userMessage,
                             MessageEntity assistantMessage,
                             AnswerFeedback feedback,
                             KnowledgeIssueSource source,
                             String question,
                             String reason,
                             String comment,
                             String businessModule,
                             String businessEntityId) {
        KnowledgeIssue issue = new KnowledgeIssue();
        issue.setTenantId(user.getTenantId());
        issue.setKnowledgeBaseId(kb.getId());
        issue.setConversationId(conversation.getId());
        issue.setUserMessageId(userMessage == null ? null : userMessage.getId());
        issue.setAssistantMessageId(assistantMessage == null ? null : assistantMessage.getId());
        issue.setFeedbackId(feedback == null ? null : feedback.getId());
        issue.setCreatedBy(user.getId());
        issue.setSource(source);
        issue.setStatus(KnowledgeIssueStatus.OPEN);
        issue.setQuestion(trimToNull(question, 2000) == null
                ? (userMessage == null ? "未关联原始问题" : userMessage.getContent())
                : trimToNull(question, 2000));
        issue.setAnswerSummary(assistantMessage == null ? null : trimToNull(assistantMessage.getContent(), 2000));
        issue.setReason(trimToNull(reason, 80));
        issue.setComment(trimToNull(comment, 2000));
        issue.setBusinessModule(trimToNull(businessModule, 80));
        issue.setBusinessEntityId(trimToNull(businessEntityId, 120));
        knowledgeIssueMapper.insert(issue);
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "";
        }
        try {
            return KnowledgeIssueStatus.valueOf(status.trim()).name();
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("知识缺口状态不合法");
        }
    }

    private static String trimToNull(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }

    private static AnswerFeedbackResponse toFeedbackResponse(AnswerFeedback feedback) {
        return new AnswerFeedbackResponse(
                feedback.getId().toString(),
                feedback.getKnowledgeBaseId().toString(),
                feedback.getConversationId().toString(),
                feedback.getUserMessageId() == null ? null : feedback.getUserMessageId().toString(),
                feedback.getAssistantMessageId().toString(),
                feedback.getRating(),
                feedback.getReason(),
                feedback.getComment(),
                feedback.getBusinessModule(),
                feedback.getBusinessEntityId(),
                feedback.getCreatedAt(),
                feedback.getUpdatedAt());
    }

    private KnowledgeIssueResponse toIssueResponse(KnowledgeIssue issue) {
        return new KnowledgeIssueResponse(
                issue.getId().toString(),
                issue.getKnowledgeBaseId().toString(),
                issue.getConversationId() == null ? null : issue.getConversationId().toString(),
                issue.getUserMessageId() == null ? null : issue.getUserMessageId().toString(),
                issue.getAssistantMessageId() == null ? null : issue.getAssistantMessageId().toString(),
                issue.getFeedbackId() == null ? null : issue.getFeedbackId().toString(),
                issue.getCreatedBy() == null ? null : issue.getCreatedBy().toString(),
                issue.getSource(),
                issue.getStatus(),
                issue.getQuestion(),
                issue.getAnswerSummary(),
                issue.getReason(),
                issue.getComment(),
                issue.getBusinessModule(),
                issue.getBusinessEntityId(),
                issue.getResolutionNote(),
                issue.getResolvedBy() == null ? null : issue.getResolvedBy().toString(),
                issue.getResolvedAt(),
                issue.getCreatedAt(),
                issue.getUpdatedAt());
    }
}
