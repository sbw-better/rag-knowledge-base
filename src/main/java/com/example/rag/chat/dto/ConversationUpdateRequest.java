package com.example.rag.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 会话更新请求。
 */
public record ConversationUpdateRequest(
        @NotBlank @Size(max = 120) String title
) {
}
