package com.example.rag.retrieval;

import com.example.rag.config.AppProperties;
import com.example.rag.domain.DocumentChunk;
import com.example.rag.domain.DocumentEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Milvus REST 向量索引封装。
 *
 * <p>MySQL 保存 chunk 事实数据，Milvus 保存可重建的向量索引。这里隔离 Milvus REST API，
 * 避免业务 Service 直接感知 collection、filter、insert/search/delete 等底层细节。</p>
 */
@Component
public class MilvusVectorStore {
    private static final Logger log = LoggerFactory.getLogger(MilvusVectorStore.class);

    private final AppProperties properties;
    private final RestClient milvusRestClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MilvusVectorStore(AppProperties properties) {
        this.properties = properties;
        this.milvusRestClient = RestClient.builder()
                .baseUrl(properties.milvus().endpoint())
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    public boolean enabled() {
        return properties.milvus().enabled();
    }

    /**
     * 确保 collection 存在。当前使用 Milvus REST 的 quick setup 创建 dense vector collection，
     * 业务字段通过动态字段写入，后续如需更严格 schema 可切换为显式 schema 初始化。
     */
    public void ensureCollection() {
        if (!enabled()) {
            return;
        }
        try {
            Map<String, Object> hasBody = baseBody();
            String hasJson = milvusRestClient.post()
                    .uri("/v2/vectordb/collections/has")
                    .body(hasBody)
                    .retrieve()
                    .body(String.class);
            JsonNode has = objectMapper.readTree(hasJson);
            if (has.path("data").asBoolean(false)) {
                log.debug("Milvus collection already exists. collection={}", collection());
                return;
            }

            Map<String, Object> createBody = baseBody();
            createBody.put("dimension", properties.model().embeddingDimensions());
            createBody.put("primaryFieldName", "chunk_id");
            createBody.put("vectorFieldName", "dense_vector");
            createBody.put("metricType", "COSINE");
            milvusRestClient.post()
                    .uri("/v2/vectordb/collections/create")
                    .body(createBody)
                    .retrieve()
                    .toBodilessEntity();
            log.info("Milvus collection created. collection={}, dimensions={}",
                    collection(), properties.model().embeddingDimensions());
        } catch (Exception ex) {
            log.warn("Milvus collection initialization failed. endpoint={}, collection={}",
                    properties.milvus().endpoint(), collection(), ex);
            throw new IllegalStateException("Milvus collection initialization failed: " + ex.getMessage(), ex);
        }
    }

    public void upsertChunk(DocumentEntity document, DocumentChunk chunk, List<Double> embedding) {
        if (!enabled()) {
            return;
        }
        Map<String, Object> entity = new LinkedHashMap<>();
        entity.put("chunk_id", chunk.getId());
        entity.put("tenant_id", chunk.getTenantId());
        entity.put("knowledge_base_id", chunk.getKnowledgeBaseId());
        entity.put("document_id", chunk.getDocumentId());
        entity.put("file_name", document.getFileName());
        entity.put("chunk_index", chunk.getChunkIndex());
        entity.put("content", chunk.getContent());
        entity.put("metadata_json", chunk.getMetadataJson());
        entity.put("dense_vector", embedding);

        Map<String, Object> body = baseBody();
        body.put("data", List.of(entity));
        milvusRestClient.post()
                .uri("/v2/vectordb/entities/insert")
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public void deleteByDocument(Long documentId) {
        if (!enabled()) {
            return;
        }
        Map<String, Object> body = baseBody();
        body.put("filter", "document_id == " + documentId);
        milvusRestClient.post()
                .uri("/v2/vectordb/entities/delete")
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public List<SearchCandidate> vectorSearch(Long tenantId, Long knowledgeBaseId, List<Double> embedding, int topK) {
        if (!enabled()) {
            return List.of();
        }
        Map<String, Object> body = baseBody();
        body.put("data", List.of(embedding));
        body.put("annsField", "dense_vector");
        body.put("limit", topK);
        body.put("filter", "tenant_id == " + tenantId + " and knowledge_base_id == " + knowledgeBaseId);
        body.put("outputFields", List.of("chunk_id", "document_id", "file_name", "chunk_index", "content"));

        String json = milvusRestClient.post()
                .uri("/v2/vectordb/entities/search")
                .body(body)
                .retrieve()
                .body(String.class);
        return parseSearch(json);
    }

    private List<SearchCandidate> parseSearch(String json) {
        try {
            JsonNode data = objectMapper.readTree(json).path("data");
            List<SearchCandidate> hits = new ArrayList<>();
            if (!data.isArray()) {
                return hits;
            }
            for (JsonNode item : data) {
                JsonNode entity = item.has("entity") ? item.path("entity") : item;
                long chunkId = firstLong(entity, item, "chunk_id", "id");
                if (chunkId == 0L) {
                    continue;
                }
                hits.add(new SearchCandidate(
                        chunkId,
                        firstLong(entity, item, "document_id", "documentId"),
                        firstText(entity, item, "file_name", "fileName"),
                        (int) firstLong(entity, item, "chunk_index", "chunkIndex"),
                        firstText(entity, item, "content"),
                        firstDouble(item, entity, "score", "distance"),
                        "VECTOR"));
            }
            return hits;
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to parse Milvus search response", ex);
        }
    }

    private Map<String, Object> baseBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("collectionName", collection());
        if (properties.milvus().database() != null && !properties.milvus().database().isBlank()) {
            body.put("dbName", properties.milvus().database());
        }
        return body;
    }

    private String collection() {
        return properties.milvus().collection();
    }

    private static long firstLong(JsonNode primary, JsonNode secondary, String... names) {
        for (String name : names) {
            JsonNode value = primary.path(name);
            if (!value.isMissingNode() && !value.isNull()) {
                return value.asLong();
            }
            value = secondary.path(name);
            if (!value.isMissingNode() && !value.isNull()) {
                return value.asLong();
            }
        }
        return 0L;
    }

    private static double firstDouble(JsonNode primary, JsonNode secondary, String... names) {
        for (String name : names) {
            JsonNode value = primary.path(name);
            if (!value.isMissingNode() && !value.isNull()) {
                return value.asDouble();
            }
            value = secondary.path(name);
            if (!value.isMissingNode() && !value.isNull()) {
                return value.asDouble();
            }
        }
        return 0.0;
    }

    private static String firstText(JsonNode primary, JsonNode secondary, String... names) {
        for (String name : names) {
            JsonNode value = primary.path(name);
            if (!value.isMissingNode() && !value.isNull()) {
                return value.asText();
            }
            value = secondary.path(name);
            if (!value.isMissingNode() && !value.isNull()) {
                return value.asText();
            }
        }
        return "";
    }
}
