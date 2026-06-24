package com.example.rag.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;

/**
 * 生产环境启动安全检查。
 *
 * <p>开发环境为了方便本地运行，会在配置里提供一些默认值；但这些默认值不能带到生产环境。
 * 该配置通过 {@link ApplicationRunner} 在 Spring 容器启动完成后执行一次，如果当前 profile
 * 包含 {@code prod}，就检查 JWT 密钥、MinIO 默认账号和模型 API Key 等高风险配置。</p>
 *
 * <p>这种检查属于“启动即失败”的保护：发现危险配置时直接阻止应用启动，比等到线上运行后
 * 暴露安全问题更可控。</p>
 */
@Configuration
public class ProductionSafetyConfig {
    private static final String DEFAULT_JWT_SECRET = "change-me-change-me-change-me-change-me";

    /**
     * 生产 profile 下校验关键密钥是否已经替换为真实安全配置。
     */
    @Bean
    ApplicationRunner validateProductionConfiguration(AppProperties properties, Environment environment) {
        return args -> {
            boolean prod = Arrays.asList(environment.getActiveProfiles()).contains("prod");
            if (!prod) {
                return;
            }
            if (properties.security().jwtSecret() == null
                    || DEFAULT_JWT_SECRET.equals(properties.security().jwtSecret())
                    || properties.security().jwtSecret().length() < 32) {
                throw new IllegalStateException("Production JWT_SECRET must be configured and at least 32 characters long.");
            }
            if ("minioadmin".equals(properties.storage().accessKey())
                    || "minioadmin".equals(properties.storage().secretKey())) {
                throw new IllegalStateException("Production MinIO credentials must not use default minioadmin values.");
            }
            if (properties.model().apiKey() == null || properties.model().apiKey().isBlank()) {
                throw new IllegalStateException("Production OPENAI_API_KEY must be configured through an environment variable or secret manager.");
            }
        };
    }
}
