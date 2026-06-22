package com.example.rag.document;

import com.example.rag.common.ApiResponse;
import com.example.rag.dto.ApiDtos;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    private final DocumentService documentService;

    @GetMapping("/{id}")
    ApiResponse<ApiDtos.DocumentResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.get(id));
    }
}
