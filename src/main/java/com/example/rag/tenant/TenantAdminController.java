package com.example.rag.tenant;

import com.example.rag.common.ApiResponse;
import com.example.rag.tenant.dto.TenantRequest;
import com.example.rag.tenant.dto.TenantResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 平台租户管理接口。
 */
@RestController
@RequestMapping("/api/admin/tenants")
public class TenantAdminController {
    private final TenantAdminService tenantAdminService;

    public TenantAdminController(TenantAdminService tenantAdminService) {
        this.tenantAdminService = tenantAdminService;
    }

    @GetMapping
    ApiResponse<List<TenantResponse>> listTenants() {
        return ApiResponse.ok(tenantAdminService.listTenants());
    }

    @PostMapping
    ApiResponse<TenantResponse> createTenant(@Valid @RequestBody TenantRequest request) {
        return ApiResponse.ok(tenantAdminService.createTenant(request));
    }
}
