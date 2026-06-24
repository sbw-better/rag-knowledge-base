package com.example.rag.config;

import com.example.rag.storage.StorageService;
import io.minio.MinioClient;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/**
 * 基础设施 Bean 配置。
 *
 * <p>该类只负责创建“技术设施”对象，例如 MinIO 客户端、模型 HTTP 客户端和启动后检查。
 * 它不处理具体业务请求。Spring Boot 启动时会执行这里的 {@code @Bean} 方法，把返回对象
 * 放入 Spring 容器，后续 Service 通过构造器注入直接复用这些对象。</p>
 */
@Configuration
public class InfrastructureConfig {
    /**
     * 创建 MinIO 客户端。
     *
     * <p>DocumentService 上传文件时不会自己拼接 MinIO 连接，而是通过 StorageService 间接使用
     * 这个客户端。这样对象存储的 endpoint、账号和 bucket 都集中由配置管理。</p>
     */
    @Bean
    MinioClient minioClient(AppProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.storage().endpoint())
                .credentials(properties.storage().accessKey(), properties.storage().secretKey())
                .build();
    }

    /**
     * 创建 OpenAI-compatible HTTP 客户端。
     *
     * <p>OpenAiCompatibleClient 会基于这个 RestClient 调用 {@code /embeddings} 和
     * {@code /chat/completions}。这里统一设置 baseUrl、JSON 请求头和超时时间，避免模型调用
     * 没有超时导致文档入库或问答请求长时间挂起。</p>
     */
    @Bean
    RestClient openAiRestClient(AppProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(15));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));
        return RestClient.builder()
                .baseUrl(properties.model().baseUrl())
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Spring 容器启动完成后执行一次的检查任务。
     *
     * <p>ApplicationRunner 和 Controller 不同，它不是接口请求触发，而是应用启动后自动运行。
     * 这里用于确保 MinIO bucket 存在，避免用户第一次上传文档时才因为 bucket 缺失报错。</p>
     */
    @Bean
    ApplicationRunner ensureBucket(StorageService storageService) {
        return args -> storageService.ensureBucket();
    }
}
