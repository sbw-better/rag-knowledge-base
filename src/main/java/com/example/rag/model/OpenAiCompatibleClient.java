package com.example.rag.model;

import com.example.rag.common.BadRequestException;
import com.example.rag.config.AppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * OpenAI-compatible 模型客户端。
 *
 * <p>该实现同时承担 Embedding 和 Chat 调用。配置了 API Key 时调用真实模型；
 * 未配置 API Key 时，Embedding 会使用确定性的本地 fallback，Chat 会返回提示文案，
 * 方便开发阶段在没有模型 Key 的情况下验证上传、切片、检索和引用链路。</p>
 */
@Component
public class OpenAiCompatibleClient implements EmbeddingClient, LlmClient {
    private static final Logger log = LoggerFactory.getLogger(OpenAiCompatibleClient.class);

    private final RestClient openAiRestClient;
    private final AppProperties properties;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient streamingHttpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    public OpenAiCompatibleClient(RestClient openAiRestClient, AppProperties properties) {
        this.openAiRestClient = openAiRestClient;
        this.properties = properties;
    }

    @Override
    public List<Double> embed(String text) {
        if (blank(properties.model().apiKey())) {
            log.debug("Using local fallback embedding. dimensions={}, textLength={}",
                    properties.model().embeddingDimensions(), text == null ? 0 : text.length());
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
            log.debug("Embedding request succeeded. model={}, dimensions={}, textLength={}",
                    properties.model().embeddingModel(), values.size(), text == null ? 0 : text.length());
            return values;
        } catch (ResourceAccessException ex) {
            log.warn("Embedding request failed by network. baseUrl={}, model={}",
                    properties.model().baseUrl(), properties.model().embeddingModel());
            throw new BadRequestException("Embedding 调用失败：无法连接模型服务。请检查网络是否能访问 "
                    + properties.model().baseUrl()
                    + "，或改用可访问的 OpenAI-compatible 地址。");
        } catch (RestClientResponseException ex) {
            log.warn("Embedding request rejected. baseUrl={}, model={}, status={}",
                    properties.model().baseUrl(), properties.model().embeddingModel(), ex.getStatusCode().value());
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
            log.debug("Using chat fallback because OPENAI_API_KEY is empty.");
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
            String answer = objectMapper.readTree(json).path("choices").get(0).path("message").path("content").asText();
            log.info("Chat request succeeded. model={}, messages={}", properties.model().chatModel(), messages.size());
            return answer;
        } catch (ResourceAccessException ex) {
            log.warn("Chat request failed by network. baseUrl={}, model={}",
                    properties.model().baseUrl(), properties.model().chatModel());
            throw new BadRequestException("Chat 调用失败：无法连接模型服务。请检查网络是否能访问 "
                    + properties.model().baseUrl()
                    + "，或改用可访问的 OpenAI-compatible 地址。");
        } catch (RestClientResponseException ex) {
            log.warn("Chat request rejected. baseUrl={}, model={}, status={}",
                    properties.model().baseUrl(), properties.model().chatModel(), ex.getStatusCode().value());
            throw new BadRequestException("Chat 调用失败：模型服务返回 HTTP "
                    + ex.getStatusCode().value()
                    + "。请检查 API Key、模型名、余额和接口地址。");
        } catch (Exception ex) {
            throw new BadRequestException("Chat 调用失败：" + ex.getMessage());
        }
    }

    @Override
    public void chatStream(List<Map<String, String>> messages, Consumer<String> onDelta) {
        if (blank(properties.model().apiKey())) {
            log.debug("Using chat stream fallback because OPENAI_API_KEY is empty.");
            onDelta.accept("OPENAI_API_KEY is not configured. Retrieval is working; configure a model key for final LLM answers.");
            return;
        }
        Map<String, Object> body = new HashMap<>();
        body.put("model", properties.model().chatModel());
        body.put("messages", messages);
        body.put("temperature", 0.2);
        body.put("stream", true);
        try {
            HttpRequest request = HttpRequest.newBuilder(chatCompletionsUri())
                    .timeout(Duration.ofMinutes(3))
                    .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + properties.model().apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                    .build();
            HttpResponse<Stream<String>> response = streamingHttpClient.send(request, HttpResponse.BodyHandlers.ofLines());
            try (Stream<String> lines = response.body()) {
                if (response.statusCode() / 100 != 2) {
                    String responseBody = lines.limit(20).collect(Collectors.joining("\n"));
                    log.warn("Chat stream request rejected. baseUrl={}, model={}, status={}",
                            properties.model().baseUrl(), properties.model().chatModel(), response.statusCode());
                    throw new BadRequestException("Chat 流式调用失败：模型服务返回 HTTP "
                            + response.statusCode()
                            + "。请检查 API Key、模型名、余额和接口地址。"
                            + (responseBody.isBlank() ? "" : " " + responseBody));
                }
                lines.forEach(line -> handleStreamLine(line, onDelta));
            }
            log.info("Chat stream request succeeded. model={}, messages={}", properties.model().chatModel(), messages.size());
        } catch (BadRequestException ex) {
            throw ex;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Chat 流式调用失败：请求被中断。");
        } catch (Exception ex) {
            throw new BadRequestException("Chat 流式调用失败：" + ex.getMessage());
        }
    }

    private URI chatCompletionsUri() {
        String baseUrl = properties.model().baseUrl();
        while (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        return URI.create(baseUrl + "/chat/completions");
    }

    private void handleStreamLine(String line, Consumer<String> onDelta) {
        if (line == null || line.isBlank() || line.startsWith(":") || !line.startsWith("data:")) {
            return;
        }
        String data = line.substring("data:".length()).trim();
        if ("[DONE]".equals(data)) {
            return;
        }
        try {
            JsonNode choice = objectMapper.readTree(data).path("choices").get(0);
            String delta = choice.path("delta").path("content").asText("");
            if (!delta.isEmpty()) {
                onDelta.accept(delta);
            }
        } catch (Exception ex) {
            log.debug("Ignored malformed chat stream line. line={}", line);
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static List<Double> localEmbedding(String text, int dimensions) {
        // 使用哈希袋模型生成稳定向量。它不是语义向量，只用于无 API Key 时验证系统链路。
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
