package com.example.rag.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Security security,
        Storage storage,
        Model model,
        Ingestion ingestion,
        Retrieval retrieval
) {
    public record Security(String jwtSecret, long jwtExpirationMinutes) {
    }

    public record Storage(String endpoint, String accessKey, String secretKey, String bucket) {
    }

    public record Model(String baseUrl, String apiKey, String chatModel, String embeddingModel, int embeddingDimensions) {
    }

    public record Ingestion(boolean workerEnabled, long fixedDelayMs, int maxAttempts, int batchSize) {
    }

    public record Retrieval(double vectorWeight, double keywordWeight) {
    }
}
