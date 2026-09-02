package com.example.rag.support;

import com.example.rag.common.ApiResponse;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.support.dto.CreateDemoTicketsRequest;
import com.example.rag.support.dto.GenerateTicketReplyRequest;
import com.example.rag.support.dto.SupportTicketRequest;
import com.example.rag.support.dto.SupportTicketResponse;
import com.example.rag.support.dto.TicketAssistantReplyResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 售后工单接口入口。
 */
@RestController
@RequestMapping("/api/support-tickets")
public class SupportTicketController {
    private final SupportTicketService ticketService;

    public SupportTicketController(SupportTicketService ticketService) {
        this.ticketService = ticketService;
    }

    @GetMapping
    ApiResponse<PageResponse<SupportTicketResponse>> list(
            @RequestParam(required = false) Long knowledgeBaseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(ticketService.list(knowledgeBaseId, status, priority, PageRequestParams.of(page, pageSize, keyword)));
    }

    @GetMapping("/{id}")
    ApiResponse<SupportTicketResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(ticketService.get(id));
    }

    @PostMapping
    ApiResponse<SupportTicketResponse> create(@Valid @RequestBody SupportTicketRequest request) {
        return ApiResponse.ok(ticketService.create(request));
    }

    @PatchMapping("/{id}")
    ApiResponse<SupportTicketResponse> update(@PathVariable Long id, @Valid @RequestBody SupportTicketRequest request) {
        return ApiResponse.ok(ticketService.update(id, request));
    }

    @PostMapping("/demo")
    ApiResponse<List<SupportTicketResponse>> createDemoTickets(@Valid @RequestBody CreateDemoTicketsRequest request) {
        return ApiResponse.ok(ticketService.createDemoTickets(request));
    }

    @PostMapping("/{id}/assistant-reply")
    ApiResponse<TicketAssistantReplyResponse> generateAssistantReply(
            @PathVariable Long id,
            @RequestBody(required = false) GenerateTicketReplyRequest request) {
        return ApiResponse.ok(ticketService.generateAssistantReply(id, request));
    }
}
