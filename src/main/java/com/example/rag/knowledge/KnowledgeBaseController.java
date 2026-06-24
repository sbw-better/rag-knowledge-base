package com.example.rag.knowledge;

import com.example.rag.common.ApiResponse;
import com.example.rag.document.DocumentService;
import com.example.rag.document.dto.DocumentItem;
import com.example.rag.document.dto.UploadResponse;
import com.example.rag.knowledge.dto.KnowledgeBaseRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/knowledge-bases")
public class KnowledgeBaseController {
    public KnowledgeBaseController(KnowledgeBaseService knowledgeBaseService, DocumentService documentService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.documentService = documentService;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentService documentService;

    @PostMapping
    ApiResponse<KnowledgeBaseResponse> create(@Valid @RequestBody KnowledgeBaseRequest request) {
        return ApiResponse.ok(knowledgeBaseService.create(request));
    }

    @GetMapping
    ApiResponse<List<KnowledgeBaseResponse>> list() {
        return ApiResponse.ok(knowledgeBaseService.list());
    }

    @GetMapping("/{id}")
    ApiResponse<KnowledgeBaseResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(knowledgeBaseService.get(id));
    }

    @GetMapping("/{id}/documents")
    ApiResponse<List<DocumentItem>> listDocuments(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.listByKnowledgeBase(id));
    }

    @PatchMapping("/{id}")
    ApiResponse<KnowledgeBaseResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody KnowledgeBaseRequest request) {
        return ApiResponse.ok(knowledgeBaseService.update(id, request));
    }

    @DeleteMapping("/{id}")
    ApiResponse<Void> delete(@PathVariable UUID id) {
        knowledgeBaseService.delete(id);
        return ApiResponse.ok(null);
    }

    @PostMapping(value = "/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ApiResponse<UploadResponse> uploadDocument(
            @PathVariable UUID id,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(documentService.upload(id, file));
    }
}
