package com.example.rag.chat;

import com.example.rag.common.ApiResponse;
import com.example.rag.dto.ApiDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ConversationController {
    private final ChatService chatService;

    @GetMapping("/{id}")
    ApiResponse<ApiDtos.ConversationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(chatService.getConversation(id));
    }
}
