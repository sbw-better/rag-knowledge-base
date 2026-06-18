package com.example.rag.document;

import com.example.rag.common.ApiResponse;
import com.example.rag.dto.ApiDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {
    private final DocumentService documentService;

    @GetMapping("/{id}")
    ApiResponse<ApiDtos.TaskResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(documentService.getTask(id));
    }
}
