package com.example.rag.chat;

import com.example.rag.common.ApiResponse;
import com.example.rag.chat.dto.ConversationResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;


/**
 * 会话历史查询接口。
 *
 * <p>问答接口负责追加消息；该接口负责读取某个会话下的完整消息列表和每条助手消息的引用来源。
 * 会话按当前登录用户隔离，用户只能查看自己的会话。</p>
 */
@RestController
@RequestMapping("/api/conversations")
public class ConversationController {
    public ConversationController(ChatService chatService) {
        this.chatService = chatService;
    }

    private final ChatService chatService;

    /**
     * 查询当前用户在某个知识库下最近一次会话。
     *
     * <p>用于前端刷新页面、重新进入问答页后恢复最近问答内容；如果还没有问答历史，
     * data 返回 null。</p>
     */
    @GetMapping("/latest")
    ApiResponse<ConversationResponse> latest(@RequestParam Long knowledgeBaseId) {
        return ApiResponse.ok(chatService.getLatestConversation(knowledgeBaseId));
    }

    /**
     * 查询指定会话详情。
     */
    @GetMapping("/{id}")
    ApiResponse<ConversationResponse> get(@PathVariable Long id) {
        return ApiResponse.ok(chatService.getConversation(id));
    }
}
