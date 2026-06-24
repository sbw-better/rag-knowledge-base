package com.example.rag.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import java.util.Arrays;

@Configuration
public class ProductionSafetyConfig {
    private static final String DEFAULT_JWT_SECRET = "change-me-change-me-change-me-change-me";

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
