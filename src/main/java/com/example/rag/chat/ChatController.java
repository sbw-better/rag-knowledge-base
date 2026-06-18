package com.example.rag.chat;

import com.example.rag.common.ApiResponse;
import com.example.rag.dto.ApiDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {
    private final ChatService chatService;

    @PostMapping
    ApiResponse<ApiDtos.ChatResponse> chat(@Valid @RequestBody ApiDtos.ChatRequest request) {
        return ApiResponse.ok(chatService.chat(request));
    }
}
