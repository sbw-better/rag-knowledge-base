package com.example.rag.domain;

/**
 * 会话消息角色。
 *
 * <p>USER 为用户问题，ASSISTANT 为模型回答，SYSTEM 预留给系统提示或后续完整消息记录。</p>
 */
public enum MessageRole {
    USER, ASSISTANT, SYSTEM
}
