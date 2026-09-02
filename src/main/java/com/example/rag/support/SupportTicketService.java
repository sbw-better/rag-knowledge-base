package com.example.rag.support;

import com.example.rag.auth.CurrentUser;
import com.example.rag.audit.AuditLogService;
import com.example.rag.chat.ChatService;
import com.example.rag.chat.dto.ChatRequest;
import com.example.rag.chat.dto.ChatResponse;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.Ids;
import com.example.rag.common.NotFoundException;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.SupportTicket;
import com.example.rag.domain.SupportTicketPriority;
import com.example.rag.domain.SupportTicketStatus;
import com.example.rag.domain.UserAccount;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.SupportTicketMapper;
import com.example.rag.support.dto.CreateDemoTicketsRequest;
import com.example.rag.support.dto.GenerateTicketReplyRequest;
import com.example.rag.support.dto.SupportTicketRequest;
import com.example.rag.support.dto.SupportTicketResponse;
import com.example.rag.support.dto.TicketAssistantReplyResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * 售后工单业务服务。
 */
@Service
public class SupportTicketService {
    private static final String BUSINESS_MODULE = "SUPPORT_TICKET";
    private static final DateTimeFormatter TICKET_NO_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.UTC);

    private final SupportTicketMapper ticketMapper;
    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final KnowledgeBaseService knowledgeBaseService;
    private final ChatService chatService;
    private final AuditLogService auditLogService;

    public SupportTicketService(SupportTicketMapper ticketMapper,
                                KnowledgeBaseMapper knowledgeBaseMapper,
                                KnowledgeBaseService knowledgeBaseService,
                                ChatService chatService,
                                AuditLogService auditLogService) {
        this.ticketMapper = ticketMapper;
        this.knowledgeBaseMapper = knowledgeBaseMapper;
        this.knowledgeBaseService = knowledgeBaseService;
        this.chatService = chatService;
        this.auditLogService = auditLogService;
    }

    @Transactional(readOnly = true)
    public PageResponse<SupportTicketResponse> list(Long knowledgeBaseId,
                                                    String status,
                                                    String priority,
                                                    PageRequestParams params) {
        UserAccount user = CurrentUser.required();
        if (knowledgeBaseId != null) {
            knowledgeBaseService.requireAccess(knowledgeBaseId);
        }
        String safeStatus = normalizeStatus(status);
        String safePriority = normalizePriority(priority);
        long total = ticketMapper.countByTenantId(user.getTenantId(), knowledgeBaseId, safeStatus, safePriority, params.keyword());
        List<SupportTicketResponse> items = ticketMapper.selectPageByTenantId(
                        user.getTenantId(), knowledgeBaseId, safeStatus, safePriority, params.keyword(), params.pageSize(), params.offset())
                .stream()
                .map(this::toResponse)
                .toList();
        return PageResponse.of(items, params.page(), params.pageSize(), total);
    }

    @Transactional(readOnly = true)
    public SupportTicketResponse get(Long id) {
        SupportTicket ticket = loadTicket(id);
        knowledgeBaseService.requireAccess(ticket.getKnowledgeBaseId());
        return toResponse(ticket);
    }

    @Transactional
    public SupportTicketResponse create(SupportTicketRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(Ids.parse(request.knowledgeBaseId(), "knowledgeBaseId"));
        SupportTicket ticket = new SupportTicket();
        ticket.setTenantId(user.getTenantId());
        ticket.setKnowledgeBaseId(kb.getId());
        ticket.setCreatedBy(user.getId());
        apply(ticket, request, true);
        ticketMapper.insert(ticket);
        auditLogService.record(user, "SUPPORT_TICKET_CREATE", "SUPPORT_TICKET", ticket.getId(),
                "创建售后工单：" + ticket.getTicketNo());
        return toResponse(ticket);
    }

    @Transactional
    public SupportTicketResponse update(Long id, SupportTicketRequest request) {
        SupportTicket ticket = loadTicket(id);
        UserAccount user = CurrentUser.required();
        knowledgeBaseService.requireAccess(Ids.parse(request.knowledgeBaseId(), "knowledgeBaseId"));
        if (!user.getTenantId().equals(ticket.getTenantId())) {
            throw new NotFoundException("工单不存在");
        }
        ticket.setKnowledgeBaseId(Ids.parse(request.knowledgeBaseId(), "knowledgeBaseId"));
        apply(ticket, request, false);
        ticketMapper.updateById(ticket);
        auditLogService.record(user, "SUPPORT_TICKET_UPDATE", "SUPPORT_TICKET", ticket.getId(),
                "更新售后工单：" + ticket.getTicketNo());
        return toResponse(ticket);
    }

    @Transactional
    public List<SupportTicketResponse> createDemoTickets(CreateDemoTicketsRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseService.requireAccess(Ids.parse(request.knowledgeBaseId(), "knowledgeBaseId"));
        Instant now = Instant.now();
        List<SupportTicket> tickets = List.of(
                demoTicket(user, kb, "退货退款", "官网在线客服", "林女士", "PLUS会员", "ORD-20260902-1001",
                        "已签收", "智能恒温养生壶", "KTL-PRO-2L", SupportTicketPriority.HIGH,
                        "客户收到商品后发现加热底座有轻微划痕，询问是否可以七天无理由退货并由商家承担运费。",
                        "我昨天收到养生壶，底座有划痕但还能用。这个情况能不能退货？运费谁出？", now),
                demoTicket(user, kb, "保修换新", "微信小程序", "周先生", "企业客户", "ORD-20260825-0886",
                        "已完成", "蓝牙降噪耳机", "HP-NC800", SupportTicketPriority.URGENT,
                        "客户购买 9 天后反馈左耳无法充电，希望确认是否可以直接换新以及需要准备哪些材料。",
                        "耳机左耳放进盒子一直不充电，刚买没多久。可以直接给我换新吗？", now),
                demoTicket(user, kb, "物流异常", "电话客服", "赵同学", "普通客户", "ORD-20260830-3210",
                        "运输中", "便携投影仪", "PJ-MINI-A1", SupportTicketPriority.NORMAL,
                        "客户订单超过承诺时效仍未派送，要求客服说明补偿规则和下一步处理时限。",
                        "页面说最晚今天送到，现在还没派送。如果耽误使用，你们怎么处理？", now)
        );
        tickets.forEach(ticketMapper::insert);
        auditLogService.record(user, "SUPPORT_TICKET_DEMO_CREATE", "SUPPORT_TICKET", kb.getId(),
                "生成售后演示工单：" + tickets.size() + " 条");
        return tickets.stream().map(this::toResponse).toList();
    }

    @Transactional
    public TicketAssistantReplyResponse generateAssistantReply(Long id, GenerateTicketReplyRequest request) {
        SupportTicket ticket = loadTicket(id);
        KnowledgeBase kb = knowledgeBaseService.requireAccess(ticket.getKnowledgeBaseId());
        String businessContext = buildBusinessContext(ticket);
        String question = buildReplyQuestion(ticket, request == null ? null : request.instruction());
        String conversationId = ticket.getAiConversationId() == null ? null : ticket.getAiConversationId().toString();
        ChatResponse chat = chatService.chat(new ChatRequest(
                kb.getId().toString(),
                conversationId,
                question,
                null,
                BUSINESS_MODULE,
                ticket.getId().toString(),
                businessContext));
        ticket.setLatestAiReply(chat.answer());
        ticket.setAiConversationId(Ids.parse(chat.conversationId(), "conversationId"));
        if (ticket.getStatus() == SupportTicketStatus.OPEN) {
            ticket.setStatus(SupportTicketStatus.IN_PROGRESS);
        }
        ticket.setUpdatedAt(Instant.now());
        ticketMapper.updateById(ticket);
        UserAccount user = CurrentUser.required();
        auditLogService.record(user, "SUPPORT_TICKET_AI_REPLY", "SUPPORT_TICKET", ticket.getId(),
                "生成工单客服回复：" + ticket.getTicketNo());
        return new TicketAssistantReplyResponse(toResponse(ticket), chat);
    }

    private SupportTicket loadTicket(Long id) {
        UserAccount user = CurrentUser.required();
        SupportTicket ticket = ticketMapper.selectByIdAndTenantId(id, user.getTenantId());
        if (ticket == null) {
            throw new NotFoundException("工单不存在");
        }
        return ticket;
    }

    private void apply(SupportTicket ticket, SupportTicketRequest request, boolean creating) {
        Instant now = Instant.now();
        ticket.setTicketNo(trimToNull(request.ticketNo(), 40) == null ? generateTicketNo(now) : trimToNull(request.ticketNo(), 40));
        ticket.setStatus(request.status() == null ? SupportTicketStatus.OPEN : request.status());
        ticket.setPriority(request.priority() == null ? SupportTicketPriority.NORMAL : request.priority());
        ticket.setCategory(requiredTrim(request.category(), "category", 80));
        ticket.setChannel(requiredTrim(request.channel(), "channel", 40));
        ticket.setCustomerName(requiredTrim(request.customerName(), "customerName", 120));
        ticket.setCustomerTier(trimToNull(request.customerTier(), 40));
        ticket.setCustomerContact(trimToNull(request.customerContact(), 160));
        ticket.setOrderNo(trimToNull(request.orderNo(), 80));
        ticket.setOrderStatus(trimToNull(request.orderStatus(), 80));
        ticket.setProductName(trimToNull(request.productName(), 160));
        ticket.setProductSku(trimToNull(request.productSku(), 80));
        ticket.setPurchasedAt(request.purchasedAt());
        ticket.setIssueSummary(requiredTrim(request.issueSummary(), "issueSummary", 300));
        ticket.setCustomerQuestion(requiredTrim(request.customerQuestion(), "customerQuestion", 4000));
        ticket.setLatestAiReply(trimToNull(request.latestAiReply(), 4000));
        ticket.setResolvedAt(ticket.getStatus() == SupportTicketStatus.RESOLVED || ticket.getStatus() == SupportTicketStatus.CLOSED ? now : null);
        if (creating) {
            ticket.setCreatedAt(now);
        }
        ticket.setUpdatedAt(now);
    }

    private SupportTicket demoTicket(UserAccount user,
                                     KnowledgeBase kb,
                                     String category,
                                     String channel,
                                     String customerName,
                                     String customerTier,
                                     String orderNo,
                                     String orderStatus,
                                     String productName,
                                     String productSku,
                                     SupportTicketPriority priority,
                                     String issueSummary,
                                     String customerQuestion,
                                     Instant now) {
        SupportTicket ticket = new SupportTicket();
        ticket.setTenantId(user.getTenantId());
        ticket.setKnowledgeBaseId(kb.getId());
        ticket.setCreatedBy(user.getId());
        ticket.setTicketNo(generateTicketNo(now) + "-" + Math.abs(orderNo.hashCode() % 1000));
        ticket.setStatus(SupportTicketStatus.OPEN);
        ticket.setPriority(priority);
        ticket.setCategory(category);
        ticket.setChannel(channel);
        ticket.setCustomerName(customerName);
        ticket.setCustomerTier(customerTier);
        ticket.setOrderNo(orderNo);
        ticket.setOrderStatus(orderStatus);
        ticket.setProductName(productName);
        ticket.setProductSku(productSku);
        ticket.setPurchasedAt(now.minusSeconds(5 * 24 * 60 * 60));
        ticket.setIssueSummary(issueSummary);
        ticket.setCustomerQuestion(customerQuestion);
        ticket.setCreatedAt(now);
        ticket.setUpdatedAt(now);
        return ticket;
    }

    private String buildReplyQuestion(SupportTicket ticket, String instruction) {
        String extra = trimToNull(instruction, 1000);
        return """
                请基于知识库资料和当前售后工单上下文，生成一段可以直接发给客户的客服回复。
                要求：语气专业友好，先安抚客户，再说明处理结论、所需材料、下一步动作和预计时效；不要承诺知识库没有依据的政策。
                客户原问题：%s
                工单摘要：%s
                %s
                """.formatted(ticket.getCustomerQuestion(), ticket.getIssueSummary(), extra == null ? "" : "补充要求：" + extra);
    }

    private String buildBusinessContext(SupportTicket ticket) {
        return """
                业务模块：售后工单
                工单号：%s
                状态：%s
                优先级：%s
                分类：%s
                来源渠道：%s
                客户：%s（%s）
                订单号：%s
                订单状态：%s
                商品：%s
                SKU：%s
                购买时间：%s
                问题摘要：%s
                客户原问题：%s
                """.formatted(
                ticket.getTicketNo(),
                ticket.getStatus(),
                ticket.getPriority(),
                ticket.getCategory(),
                ticket.getChannel(),
                ticket.getCustomerName(),
                nullToDash(ticket.getCustomerTier()),
                nullToDash(ticket.getOrderNo()),
                nullToDash(ticket.getOrderStatus()),
                nullToDash(ticket.getProductName()),
                nullToDash(ticket.getProductSku()),
                ticket.getPurchasedAt() == null ? "-" : ticket.getPurchasedAt().toString(),
                ticket.getIssueSummary(),
                ticket.getCustomerQuestion());
    }

    private SupportTicketResponse toResponse(SupportTicket ticket) {
        KnowledgeBase kb = knowledgeBaseMapper.selectById(ticket.getKnowledgeBaseId());
        return new SupportTicketResponse(
                ticket.getId().toString(),
                ticket.getKnowledgeBaseId().toString(),
                kb == null ? "未知知识库" : kb.getName(),
                ticket.getTicketNo(),
                ticket.getStatus(),
                ticket.getPriority(),
                ticket.getCategory(),
                ticket.getChannel(),
                ticket.getCustomerName(),
                ticket.getCustomerTier(),
                ticket.getCustomerContact(),
                ticket.getOrderNo(),
                ticket.getOrderStatus(),
                ticket.getProductName(),
                ticket.getProductSku(),
                ticket.getPurchasedAt(),
                ticket.getIssueSummary(),
                ticket.getCustomerQuestion(),
                ticket.getLatestAiReply(),
                ticket.getAiConversationId() == null ? null : ticket.getAiConversationId().toString(),
                ticket.getResolvedAt(),
                ticket.getCreatedAt(),
                ticket.getUpdatedAt());
    }

    private static String generateTicketNo(Instant now) {
        return "ST-" + TICKET_NO_FORMATTER.format(now) + "-" + Math.abs(System.nanoTime() % 100_000);
    }

    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "";
        }
        try {
            return SupportTicketStatus.valueOf(status.trim()).name();
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("工单状态不合法");
        }
    }

    private static String normalizePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return "";
        }
        try {
            return SupportTicketPriority.valueOf(priority.trim()).name();
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("工单优先级不合法");
        }
    }

    private static String requiredTrim(String value, String fieldName, int maxLength) {
        String trimmed = trimToNull(value, maxLength);
        if (trimmed == null) {
            throw new BadRequestException(fieldName + " 不能为空");
        }
        return trimmed;
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

    private static String nullToDash(String value) {
        return value == null || value.isBlank() ? "-" : value;
    }
}
