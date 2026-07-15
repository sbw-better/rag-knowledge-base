package com.example.rag.tenant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * 创建租户请求。
 *
 * <p>第一版租户管理只允许平台管理员创建租户名称，不开放删除、迁移用户等高风险操作。</p>
 */
public record TenantRequest(
        @NotBlank @Size(max = 120) String name
) {
}
