package com.example.rag.chat;

import com.example.rag.common.ApiResponse;
import com.example.rag.chat.dto.ConversationResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/conversations")
public class ConversationController {
    public ConversationController(ChatService chatService) {
        this.chatService = chatService;
    }

    private final ChatService chatService;

    @GetMapping("/{id}")
    ApiResponse<ConversationResponse> get(@PathVariable UUID id) {
        return ApiResponse.ok(chatService.getConversation(id));
    }
}
