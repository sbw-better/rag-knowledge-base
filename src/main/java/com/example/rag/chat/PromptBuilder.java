package com.example.rag.chat;

import com.example.rag.retrieval.SearchCandidate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * RAG Prompt 构造器。
 *
 * <p>该类只负责把检索到的片段组织为模型消息，不直接调用模型。系统提示词要求模型
 * 仅依据上下文回答，避免在知识库证据不足时编造答案。</p>
 */
@Service
public class PromptBuilder {
    /**
     * 构建 OpenAI-compatible chat messages。
     */
    public List<Map<String, String>> build(String question, List<SearchCandidate> hits) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < hits.size(); i++) {
            SearchCandidate hit = hits.get(i);
            context.append("[Source ").append(i + 1).append("] ")
                    .append(hit.fileName()).append(" #").append(hit.chunkIndex()).append("\n")
                    .append(hit.content()).append("\n\n");
        }
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content",
                "You are a careful knowledge-base assistant. Answer only from the provided context. If the context is insufficient, say that you cannot determine the answer."));
        messages.add(Map.of("role", "user", "content",
                "Context:\n" + context + "\nQuestion:\n" + question));
        return messages;
    }
}
