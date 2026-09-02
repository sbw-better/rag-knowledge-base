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
        return build(question, hits, null);
    }

    /**
     * 构建带业务上下文的 OpenAI-compatible chat messages。
     */
    public List<Map<String, String>> build(String question, List<SearchCandidate> hits, String businessContext) {
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < hits.size(); i++) {
            SearchCandidate hit = hits.get(i);
            context.append("[Source ").append(i + 1).append("] ")
                    .append(hit.fileName()).append(" #").append(hit.chunkIndex()).append("\n")
                    .append(hit.content()).append("\n\n");
        }
        String safeBusinessContext = businessContext == null || businessContext.isBlank()
                ? "无"
                : businessContext.strip();
        List<Map<String, String>> messages = new ArrayList<>();
        messages.add(Map.of("role", "system", "content", """
                你是一个面向业务用户的知识库问答助手。
                请只依据提供的 Context 回答，不要编造 Context 中没有的信息。
                Business Context 是当前业务对象的事实背景，可以用于理解客户问题、订单、商品和处理目标；但政策、规则、时效和承诺必须由 Context 支撑。
                回答要像一位耐心、可靠的客服同事：先接住用户的问题，再用自然口吻给结论。
                优先用两三句话说明最重要的答案；如果确实有步骤或条件，再用简短列表补充。
                不要照搬原文条款，不要堆砌编号；把资料转成用户容易理解的说法。
                不要使用 Markdown 粗体、表格、标题符号或过度格式化；前端会按普通文本展示。
                不要用“根据提供的资料”“根据上下文”“根据知识库”等固定开头。
                如果用户是在问售后、退款、权限、流程等问题，语气要友好、务实，可以告诉用户下一步该怎么做。
                如果 Context 不足以回答问题，请明确说明当前资料没有覆盖，并建议用户补充资料或联系知识库负责人。
                引用来源会由系统在界面中单独展示，正文中不需要重复列出文件名。
                """));
        messages.add(Map.of("role", "user", "content",
                "Business Context:\n" + safeBusinessContext + "\n\nContext:\n" + context + "\nQuestion:\n" + question));
        return messages;
    }
}
