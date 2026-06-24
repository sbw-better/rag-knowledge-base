package com.example.rag.knowledge.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 创建或更新知识库请求。
 *
 * <p>chunkSize、chunkOverlap、topK 是知识库级默认参数。维护者在创建或设置页修改后，
 * 后续文档入库和检索问答会默认使用这些配置。普通问答用户不需要理解这些技术参数。</p>
 */
public record KnowledgeBaseRequest(
        @NotBlank @Size(max = 160) String name,
        @Size(max = 2000) String description,
        @Min(200) @Max(4000) Integer chunkSize,
        @Min(0) @Max(1000) Integer chunkOverlap,
        @Min(1) @Max(50) Integer topK
) {
}
