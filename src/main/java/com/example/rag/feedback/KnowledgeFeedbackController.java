package com.example.rag.feedback;

import com.example.rag.common.ApiResponse;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.feedback.dto.AnswerFeedbackRequest;
import com.example.rag.feedback.dto.AnswerFeedbackResponse;
import com.example.rag.feedback.dto.BusinessFeedbackLinksResponse;
import com.example.rag.feedback.dto.KnowledgeIssueResponse;
import com.example.rag.feedback.dto.ResolveKnowledgeIssueRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/knowledge-feedback")
public class KnowledgeFeedbackController {
    private final KnowledgeFeedbackService knowledgeFeedbackService;

    public KnowledgeFeedbackController(KnowledgeFeedbackService knowledgeFeedbackService) {
        this.knowledgeFeedbackService = knowledgeFeedbackService;
    }

    @PostMapping("/answer-feedback")
    ApiResponse<AnswerFeedbackResponse> submitFeedback(@Valid @RequestBody AnswerFeedbackRequest request) {
        return ApiResponse.ok(knowledgeFeedbackService.submitFeedback(request));
    }

    @GetMapping("/issues")
    ApiResponse<PageResponse<KnowledgeIssueResponse>> listIssues(
            @RequestParam Long knowledgeBaseId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(knowledgeFeedbackService.listIssues(
                knowledgeBaseId,
                status,
                PageRequestParams.of(page, pageSize, keyword)));
    }

    @GetMapping("/business-links")
    ApiResponse<BusinessFeedbackLinksResponse> listBusinessLinks(
            @RequestParam Long knowledgeBaseId,
            @RequestParam String businessModule,
            @RequestParam String businessEntityId,
            @RequestParam(required = false, defaultValue = "10") Integer limit) {
        return ApiResponse.ok(knowledgeFeedbackService.listBusinessLinks(
                knowledgeBaseId,
                businessModule,
                businessEntityId,
                limit == null ? 10 : limit));
    }

    @PostMapping("/issues/{id}/resolve")
    ApiResponse<KnowledgeIssueResponse> resolveIssue(
            @PathVariable Long id,
            @RequestBody(required = false) ResolveKnowledgeIssueRequest request) {
        return ApiResponse.ok(knowledgeFeedbackService.resolveIssue(id, request));
    }

    @PostMapping("/issues/{id}/recheck")
    ApiResponse<KnowledgeIssueResponse> recheckIssue(@PathVariable Long id) {
        return ApiResponse.ok(knowledgeFeedbackService.recheckIssue(id));
    }
}
