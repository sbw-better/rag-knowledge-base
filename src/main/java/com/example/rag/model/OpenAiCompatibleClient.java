package com.example.rag.model;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class OpenAiCompatibleClient implements EmbeddingClient, LlmClient {
    private final RestClient openAiRestClient;
    private final AppProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<Double> embed(String text) {
        if (blank(properties.model().apiKey())) {
            return localEmbedding(text, properties.model().embeddingDimensions());
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", properties.model().embeddingModel());
        body.put("input", text);
        body.put("dimensions", properties.model().embeddingDimensions());
        try {
            String json = openAiRestClient.post()
                    .uri("/embeddings")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.model().apiKey())
                    .body(body)
                    .retrieve()
                    .body(String.class);
            JsonNode embedding = objectMapper.readTree(json).path("data").get(0).path("embedding");
            List<Double> values = new ArrayList<>();
            embedding.forEach(node -> values.add(node.asDouble()));
            return values;
        } catch (Exception ex) {
            throw new BadRequestException("Embedding request failed: " + ex.getMessage());
        }
    }

    @Override
    public String chat(List<Map<String, String>> messages) {
        if (blank(properties.model().apiKey())) {
            return "OPENAI_API_KEY is not configured. Retrieval is working; configure a model key for final LLM answers.";
        }
        Map<String, Object> body = new HashMap<>();
        body.put("model", properties.model().chatModel());
        body.put("messages", messages);
        body.put("temperature", 0.2);
        try {
            String json = openAiRestClient.post()
                    .uri("/chat/completions")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.model().apiKey())
                    .body(body)
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(json).path("choices").get(0).path("message").path("content").asText();
        } catch (Exception ex) {
            throw new BadRequestException("Chat request failed: " + ex.getMessage());
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static List<Double> localEmbedding(String text, int dimensions) {
        double[] vector = new double[dimensions];
        String[] tokens = (text == null ? "" : text.toLowerCase()).split("\\W+");
        for (String token : tokens) {
            if (token.isBlank()) {
                continue;
            }
            byte[] hash = sha256(token);
            int idx = Math.floorMod(((hash[0] & 0xff) << 8) | (hash[1] & 0xff), dimensions);
            vector[idx] += 1.0;
        }
        double norm = 0.0;
        for (double v : vector) {
            norm += v * v;
        }
        norm = Math.sqrt(norm);
        List<Double> result = new ArrayList<>(dimensions);
        for (double v : vector) {
            result.add(norm == 0.0 ? 0.0 : v / norm);
        }
        return result;
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes());
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
