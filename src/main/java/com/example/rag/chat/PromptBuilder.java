package com.example.rag.chat;

import com.example.rag.retrieval.SearchCandidate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class PromptBuilder {
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
