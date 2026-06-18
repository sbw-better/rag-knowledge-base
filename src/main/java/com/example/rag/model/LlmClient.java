package com.example.rag.model;

import java.util.List;
import java.util.Map;

public interface LlmClient {
    String chat(List<Map<String, String>> messages);
}
