package com.example.rag;

import com.example.rag.chat.PromptBuilder;
import com.example.rag.retrieval.SearchCandidate;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PromptBuilderTest {
    @Test
    void buildsGroundedPromptWithSources() {
        SearchCandidate hit = new SearchCandidate(1001L, 2001L, "manual.txt",
                2, "系统支持上传文档。", 0.8, "VECTOR");

        List<Map<String, String>> messages = new PromptBuilder().build("支持什么？", List.of(hit));

        assertThat(messages).hasSize(2);
        assertThat(messages.get(0).get("content"))
                .contains("耐心、可靠的客服同事", "不要使用 Markdown 粗体", "不要照搬原文条款");
        assertThat(messages.get(1).get("content")).contains("manual.txt", "系统支持上传文档", "支持什么");
    }
}
