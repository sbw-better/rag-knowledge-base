package com.example.rag.chat;

import com.example.rag.common.ApiResponse;
import com.example.rag.chat.dto.ChatRequest;
import com.example.rag.chat.dto.ChatResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * RAG 问答接口入口。
 *
 * <p>这是普通用户最终使用的核心接口：前端提交问题，后端在指定知识库内先做检索，
 * 再把命中的文档片段拼进 Prompt 调用大模型，并返回答案和引用来源。</p>
 */
@RestController
@RequestMapping("/api/chat")
public class ChatController {
    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    private final ChatService chatService;

    /**
     * 发起一次问答。
     *
     * <p>如果请求不带 conversationId，Service 会创建新会话；如果带 conversationId，
     * 则把本次消息追加到已有会话。当前实现使用知识库默认 topK 作为召回数量。</p>
     */
    @PostMapping
    ApiResponse<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return ApiResponse.ok(chatService.chat(request));
    }

    /**
     * 发起一次流式问答。
     *
     * <p>事件说明：meta 表示会话和用户消息已创建；delta 表示模型增量文本；
     * done 表示完整回答、助手消息 ID 和引用来源已经保存；error 表示流式处理失败。</p>
     */
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    SseEmitter chatStream(@Valid @RequestBody ChatRequest request) {
        return chatService.chatStream(request);
    }
}
