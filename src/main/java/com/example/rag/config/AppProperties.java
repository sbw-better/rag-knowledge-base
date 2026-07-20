package com.example.rag.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 应用自定义配置映射。
 *
 * <p>Spring Boot 启动时会读取 {@code application.yml} 和环境变量，再把
 * {@code app.*} 下的配置绑定到这个 record。业务代码不要直接到处读取环境变量，
 * 而是通过注入 {@link AppProperties} 使用强类型配置，避免 key 拼写错误和默认值分散。</p>
 *
 * <p>例如 {@code app.security.jwt-secret} 会绑定到
 * {@link Security#jwtSecret()}，{@code app.model.base-url} 会绑定到
 * {@link Model#baseUrl()}。如果后续增加配置项，优先在这里补充字段并在文档中说明。</p>
 */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        Security security,
        Storage storage,
        Milvus milvus,
        Model model,
        Ingestion ingestion,
        Retrieval retrieval
) {
    /**
     * JWT 相关配置：签名密钥和过期时间。
     */
    public record Security(String jwtSecret, long jwtExpirationMinutes) {
    }

    /**
     * 对象存储配置。当前实现使用 MinIO，后续替换 S3、OSS、COS 时可以保持业务层不变。
     */
    public record Storage(String endpoint, String accessKey, String secretKey, String bucket) {
    }

    /**
     * Milvus 向量数据库配置。Milvus 保存可重建的检索索引，MySQL 仍是业务事实库。
     */
    public record Milvus(String endpoint, String database, String collection, boolean enabled) {
    }

    /**
     * OpenAI-compatible 模型配置，同时用于 Chat 和 Embedding。
     */
    public record Model(String baseUrl, String apiKey, String chatModel, String embeddingModel, int embeddingDimensions) {
    }

    /**
     * 文档异步入库配置，控制 worker 是否启用、扫描间隔、重试次数、批处理大小和 RUNNING 超时恢复时间。
     */
    public record Ingestion(boolean workerEnabled, long fixedDelayMs, int maxAttempts, int batchSize, long runningTimeoutMs) {
    }

    /**
     * 混合检索融合权重预留配置，后续接入更复杂的 rerank/fusion 时可以扩展。
     */
    public record Retrieval(double vectorWeight, double keywordWeight) {
    }
}
