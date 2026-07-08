package com.example.rag.document;

import com.example.rag.common.ApiResponse;
import com.example.rag.document.dto.TaskResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;


/**
 * 异步任务查询接口。
 *
 * <p>文档上传后不会在 HTTP 请求内同步完成解析和向量化，而是创建 {@code rag_tasks} 任务。
 * 前端通过该接口轮询任务状态，展示 PENDING、RUNNING、SUCCEEDED、FAILED 等状态和错误信息。</p>
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    public TaskController(DocumentService documentService) {
        this.documentService = documentService;
    }

    private final DocumentService documentService;

    /**
     * 查询任务详情。
     *
     * <p>任务查询同样按当前用户租户隔离，不能跨租户查看任务状态。</p>
     */
    @GetMapping("/{id}")
    ApiResponse<TaskResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(documentService.getTask(id));
    }
}
