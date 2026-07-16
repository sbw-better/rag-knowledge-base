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
        messages.add(Map.of("role", "system", "content", """
                你是一个面向业务用户的知识库问答助手。
                请只依据提供的 Context 回答，不要编造 Context 中没有的信息。
                回答要自然、直接、简洁，优先先给结论，再补充必要条件或步骤。
                不要用“根据提供的资料”“根据上下文”“根据知识库”等固定开头。
                如果 Context 不足以回答问题，请明确说明当前资料没有覆盖，并建议用户补充资料或联系知识库负责人。
                引用来源会由系统在界面中单独展示，正文中不需要重复列出文件名。
                """));
        messages.add(Map.of("role", "user", "content",
                "Context:\n" + context + "\nQuestion:\n" + question));
        return messages;
    }
}
