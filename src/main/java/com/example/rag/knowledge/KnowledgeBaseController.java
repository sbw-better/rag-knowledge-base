package com.example.rag.knowledge;

import com.example.rag.common.ApiResponse;
import com.example.rag.auth.dto.AdminUserResponse;
import com.example.rag.document.DocumentService;
import com.example.rag.document.dto.DocumentItem;
import com.example.rag.document.dto.UploadResponse;
import com.example.rag.knowledge.dto.KnowledgeBaseRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseMemberRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseMemberResponse;
import com.example.rag.knowledge.dto.KnowledgeBaseResponse;
import com.example.rag.retrieval.IndexMaintenanceService;
import com.example.rag.retrieval.dto.RebuildIndexResponse;
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

/**
 * 知识库管理接口入口。
 *
 * <p>知识库是整个 RAG 系统的业务边界：文档、切片、检索、问答都挂在某一个知识库下面。
 * 本 Controller 暴露知识库 CRUD、知识库下文档列表和文档上传入口；具体权限判断由
 * {@link KnowledgeBaseService} 和 {@link DocumentService} 统一处理。</p>
 */
@RestController
@RequestMapping("/api/knowledge-bases")
public class KnowledgeBaseController {
    public KnowledgeBaseController(KnowledgeBaseService knowledgeBaseService,
                                   DocumentService documentService,
                                   IndexMaintenanceService indexMaintenanceService) {
        this.knowledgeBaseService = knowledgeBaseService;
        this.documentService = documentService;
        this.indexMaintenanceService = indexMaintenanceService;
    }

    private final KnowledgeBaseService knowledgeBaseService;
    private final DocumentService documentService;
    private final IndexMaintenanceService indexMaintenanceService;

    /**
     * 创建知识库。
     *
     * <p>请求中的 chunkSize、chunkOverlap、topK 是该知识库的长期默认参数，后续上传文档、
     * 检索和问答会默认使用这些值。</p>
     */
    @PostMapping
    ApiResponse<KnowledgeBaseResponse> create(@Valid @RequestBody KnowledgeBaseRequest request) {
        return ApiResponse.ok(knowledgeBaseService.create(request));
    }

    /**
     * 查询当前用户可访问的知识库列表。
     *
     * <p>并不是简单返回全库数据；Service 会按租户、owner、ADMIN、成员权限过滤。</p>
     */
    @GetMapping
    ApiResponse<List<KnowledgeBaseResponse>> list() {
        return ApiResponse.ok(knowledgeBaseService.list());
    }

    /**
     * 查询单个知识库详情，同时校验当前用户是否有访问权限。
     */
    @GetMapping("/{id}")
    ApiResponse<KnowledgeBaseResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(knowledgeBaseService.get(id));
    }

    /**
     * 查询某个知识库下的文档及最近一次入库任务状态。
     */
    @GetMapping("/{id}/documents")
    ApiResponse<List<DocumentItem>> listDocuments(@PathVariable Long id) {
        return ApiResponse.ok(documentService.listByKnowledgeBase(id));
    }

    /**
     * 查询知识库授权成员。仅 owner 或 ADMIN 可见。
     */
    @GetMapping("/{id}/members")
    ApiResponse<List<KnowledgeBaseMemberResponse>> listMembers(@PathVariable Long id) {
        return ApiResponse.ok(knowledgeBaseService.listMembers(id));
    }

    /**
     * 查询当前知识库可授权的租户用户。仅 owner 或 ADMIN 可见。
     */
    @GetMapping("/{id}/member-candidates")
    ApiResponse<List<AdminUserResponse>> listMemberCandidates(@PathVariable Long id) {
        return ApiResponse.ok(knowledgeBaseService.listMemberCandidates(id));
    }

    /**
     * 添加或更新知识库成员授权。
     */
    @PostMapping("/{id}/members")
    ApiResponse<KnowledgeBaseMemberResponse> saveMember(
            @PathVariable Long id,
            @Valid @RequestBody KnowledgeBaseMemberRequest request) {
        return ApiResponse.ok(knowledgeBaseService.saveMember(id, request));
    }

    /**
     * 修改知识库基础信息和默认检索参数。
     */
    @PatchMapping("/{id}")
    ApiResponse<KnowledgeBaseResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody KnowledgeBaseRequest request) {
        return ApiResponse.ok(knowledgeBaseService.update(id, request));
    }

    /**
     * 逻辑删除知识库。
     *
     * <p>当前版本不会物理删除数据库记录，避免误删后难以排查；前端删除后不可恢复。</p>
     */
    @DeleteMapping("/{id}")
    ApiResponse<Void> delete(@PathVariable Long id) {
        knowledgeBaseService.delete(id);
        return ApiResponse.ok(null);
    }

    /**
     * 移除知识库成员授权。
     */
    @DeleteMapping("/{id}/members/{userId}")
    ApiResponse<Void> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        knowledgeBaseService.removeMember(id, userId);
        return ApiResponse.ok(null);
    }

    /**
     * 从 MySQL 文档切片重建 Milvus 向量索引。
     *
     * <p>该接口用于 Milvus 数据丢失、collection 重建、模型维度确认后重新生成索引。
     * 只有知识库 owner 或 ADMIN 可以执行。</p>
     */
    @PostMapping("/{id}/rebuild-index")
    ApiResponse<RebuildIndexResponse> rebuildIndex(@PathVariable Long id) {
        return ApiResponse.ok(indexMaintenanceService.rebuildKnowledgeBase(id));
    }

    /**
     * 上传文档到指定知识库。
     *
     * <p>该接口只接收文件、保存原始文件并创建异步入库任务；真正解析、切片、Embedding 和向量入库
     * 由 IngestionWorker 后台处理。</p>
     */
    @PostMapping(value = "/{id}/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ApiResponse<UploadResponse> uploadDocument(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) {
        return ApiResponse.ok(documentService.upload(id, file));
    }
}
