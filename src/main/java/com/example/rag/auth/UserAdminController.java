package com.example.rag.auth;

import com.example.rag.auth.dto.AdminUserResponse;
import com.example.rag.auth.dto.UpdateUserRolesRequest;
import com.example.rag.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 管理端用户接口。
 */
@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {
    private final UserAdminService userAdminService;

    public UserAdminController(UserAdminService userAdminService) {
        this.userAdminService = userAdminService;
    }

    @GetMapping
    ApiResponse<List<AdminUserResponse>> listUsers() {
        return ApiResponse.ok(userAdminService.listUsers());
    }

    @PatchMapping("/{id}/roles")
    ApiResponse<AdminUserResponse> updateRoles(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRolesRequest request) {
        return ApiResponse.ok(userAdminService.updateRoles(id, request));
    }
}
