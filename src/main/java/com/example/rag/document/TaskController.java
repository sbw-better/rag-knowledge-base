package com.example.rag.document;

import com.example.rag.common.ApiResponse;
import com.example.rag.document.dto.TaskResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    public TaskController(DocumentService documentService) {
        this.documentService = documentService;
    }

    private final DocumentService documentService;

    @GetMapping("/{id}")
    ApiResponse<TaskResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.getTask(id));
    }
}
