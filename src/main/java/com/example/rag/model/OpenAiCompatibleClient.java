package com.example.rag.model;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class OpenAiCompatibleClient implements EmbeddingClient, LlmClient {
    private final RestClient openAiRestClient;
    private final AppProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public OpenAiCompatibleClient(RestClient openAiRestClient, AppProperties properties) {
        this.openAiRestClient = openAiRestClient;
        this.properties = properties;
    }

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
        } catch (ResourceAccessException ex) {
            throw new BadRequestException("Embedding 调用失败：无法连接模型服务。请检查网络是否能访问 "
                    + properties.model().baseUrl()
                    + "，或改用可访问的 OpenAI-compatible 地址。");
        } catch (RestClientResponseException ex) {
            throw new BadRequestException("Embedding 调用失败：模型服务返回 HTTP "
                    + ex.getStatusCode().value()
                    + "。请检查 API Key、模型名、余额和接口地址。");
        } catch (Exception ex) {
            throw new BadRequestException("Embedding 调用失败：" + ex.getMessage());
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
        } catch (ResourceAccessException ex) {
            throw new BadRequestException("Chat 调用失败：无法连接模型服务。请检查网络是否能访问 "
                    + properties.model().baseUrl()
                    + "，或改用可访问的 OpenAI-compatible 地址。");
        } catch (RestClientResponseException ex) {
            throw new BadRequestException("Chat 调用失败：模型服务返回 HTTP "
                    + ex.getStatusCode().value()
                    + "。请检查 API Key、模型名、余额和接口地址。");
        } catch (Exception ex) {
            throw new BadRequestException("Chat 调用失败：" + ex.getMessage());
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static List<Double> localEmbedding(String text, int dimensions) {
        double[] vector = new double[dimensions];
        for (String token : localTokens(text)) {
            addToken(vector, dimensions, token, 1.0);
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

    private static List<String> localTokens(String text) {
        String normalized = text == null ? "" : text.toLowerCase();
        List<String> tokens = new ArrayList<>();
        StringBuilder asciiToken = new StringBuilder();
        List<String> cjkChars = new ArrayList<>();
        normalized.codePoints().forEach(codePoint -> {
            if (Character.isLetterOrDigit(codePoint) && Character.UnicodeScript.of(codePoint) != Character.UnicodeScript.HAN) {
                asciiToken.appendCodePoint(codePoint);
                return;
            }
            if (!asciiToken.isEmpty()) {
                tokens.add(asciiToken.toString());
                asciiToken.setLength(0);
            }
            if (Character.UnicodeScript.of(codePoint) == Character.UnicodeScript.HAN) {
                cjkChars.add(new String(Character.toChars(codePoint)));
            }
        });
        if (!asciiToken.isEmpty()) {
            tokens.add(asciiToken.toString());
        }
        tokens.addAll(cjkChars);
        for (int i = 0; i + 1 < cjkChars.size(); i++) {
            tokens.add(cjkChars.get(i) + cjkChars.get(i + 1));
        }
        return tokens;
    }

    private static void addToken(double[] vector, int dimensions, String token, double weight) {
        if (token.isBlank()) {
            return;
        }
        byte[] hash = sha256(token);
        int idx = Math.floorMod(((hash[0] & 0xff) << 8) | (hash[1] & 0xff), dimensions);
        vector[idx] += weight;
    }

    private static byte[] sha256(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes());
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
