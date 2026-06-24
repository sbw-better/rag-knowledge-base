package com.example.rag.document;

import com.example.rag.common.ApiResponse;
import com.example.rag.document.dto.DocumentResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 文档查询接口入口。
 *
 * <p>文档上传入口放在 {@code /api/knowledge-bases/{id}/documents}，因为上传必须明确归属到某个知识库。
 * 这里提供按文档 ID 查询详情的独立入口，用于前端查看文档状态、错误信息和元数据。</p>
 */
@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    private final DocumentService documentService;

    /**
     * 查询单个文档详情。
     *
     * <p>Service 会同时校验租户和知识库访问权限，避免用户通过猜测 documentId 越权查看文档。</p>
     */
    @GetMapping("/{id}")
    ApiResponse<DocumentResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.get(id));
    }
}
