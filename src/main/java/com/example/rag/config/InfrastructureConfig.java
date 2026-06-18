package com.example.rag.config;

import com.example.rag.storage.StorageService;
import io.minio.MinioClient;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

@Configuration
public class InfrastructureConfig {
    @Bean
    MinioClient minioClient(AppProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.storage().endpoint())
                .credentials(properties.storage().accessKey(), properties.storage().secretKey())
                .build();
    }

    @Bean
    RestClient openAiRestClient(AppProperties properties) {
        return RestClient.builder()
                .baseUrl(properties.model().baseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Bean
    ApplicationRunner ensureBucket(StorageService storageService) {
        return args -> storageService.ensureBucket();
    }
}
