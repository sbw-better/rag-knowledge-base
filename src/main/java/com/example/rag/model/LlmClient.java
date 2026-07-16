package com.example.rag.model;

import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

/**
 * 大语言模型聊天客户端抽象。
 *
 * <p>ChatService 只依赖该接口，不关心底层是 OpenAI、阿里云百炼还是其他兼容服务。
 * PromptBuilder 负责组装 messages，本接口只负责提交给模型并返回答案文本。</p>
 */
public interface LlmClient {
    /**
     * 发送 OpenAI-compatible messages 并返回模型回答。
     */
    String chat(List<Map<String, String>> messages);

    /**
     * 发送 OpenAI-compatible messages，并把模型增量输出逐段回调给调用方。
     *
     * <p>默认实现会退化为普通阻塞调用，方便非流式模型客户端继续复用该接口。
     * 支持 OpenAI-compatible stream 的实现可以覆盖该方法。</p>
     */
    default void chatStream(List<Map<String, String>> messages, Consumer<String> onDelta) {
        onDelta.accept(chat(messages));
    }
}
