package com.example.rag.document;

import com.example.rag.common.ApiResponse;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.document.dto.TaskBatchRequest;
import com.example.rag.document.dto.TaskListItem;
import com.example.rag.document.dto.TaskResponse;
import com.example.rag.document.dto.TaskStatsResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


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
     * 分页查询当前知识库任务。
     */
    @GetMapping
    ApiResponse<PageResponse<TaskListItem>> list(@RequestParam Long knowledgeBaseId,
                                                 @RequestParam(required = false) String type,
                                                 @RequestParam(required = false) String status,
                                                 @RequestParam(required = false) Integer page,
                                                 @RequestParam(required = false) Integer pageSize,
                                                 @RequestParam(required = false) String keyword) {
        return ApiResponse.ok(documentService.listTasks(
                knowledgeBaseId, type, status, PageRequestParams.of(page, pageSize, keyword)));
    }

    /**
     * 查询当前知识库任务统计。
     */
    @GetMapping("/stats")
    ApiResponse<TaskStatsResponse> stats(@RequestParam Long knowledgeBaseId) {
        return ApiResponse.ok(documentService.getTaskStats(knowledgeBaseId));
    }

    /**
     * 查询任务详情。
     *
     * <p>任务查询同样按当前用户租户隔离，不能跨租户查看任务状态。</p>
     */
    @GetMapping("/{id}")
    ApiResponse<TaskResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(documentService.getTask(id));
    }

    /**
     * 将失败任务重新放回入库队列。
     */
    @PostMapping("/{id}/retry")
    ApiResponse<TaskResponse> retry(@PathVariable Long id) {
        return ApiResponse.ok(documentService.retryTask(id));
    }

    /**
     * 批量重试失败任务。
     */
    @PostMapping("/batch/retry")
    ApiResponse<List<TaskResponse>> retryBatch(@RequestBody TaskBatchRequest request) {
        return ApiResponse.ok(documentService.retryTasks(request == null ? null : request.taskIds()));
    }

    /**
     * 取消等待中的任务。
     */
    @PostMapping("/{id}/cancel")
    ApiResponse<TaskResponse> cancel(@PathVariable Long id) {
        return ApiResponse.ok(documentService.cancelTask(id));
    }

    /**
     * 批量取消等待中或运行中的任务。
     */
    @PostMapping("/batch/cancel")
    ApiResponse<List<TaskResponse>> cancelBatch(@RequestBody TaskBatchRequest request) {
        return ApiResponse.ok(documentService.cancelTasks(request == null ? null : request.taskIds()));
    }
}
