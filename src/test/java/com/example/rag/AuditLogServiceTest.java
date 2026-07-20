package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.domain.AuditLog;
import com.example.rag.domain.UserAccount;
import com.example.rag.mapper.AuditLogMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class AuditLogServiceTest {
    private final AuditLogMapper auditLogMapper = mock(AuditLogMapper.class);
    private final AuditLogService service = new AuditLogService(auditLogMapper);

    @AfterEach
    void tearDown() {
        clearContext();
    }

    @Test
    void recordDoesNotBreakMainBusinessWhenMapperFails() {
        UserAccount operator = TestSecurity.user(1L, 2L, "admin@example.com", "管理员", "USER", "ADMIN");
        doThrow(new RuntimeException("database unavailable")).when(auditLogMapper).insert(any(AuditLog.class));

        service.record(operator, "DOCUMENT_UPLOAD", "DOCUMENT", 100L, "上传文档");

        verify(auditLogMapper).insert(any(AuditLog.class));
    }

    @Test
    void onlyAdminCanListAuditLogs() {
        TestSecurity.login(10L, 1L, "user@example.com", "普通用户", "USER");

        assertThatThrownBy(() -> service.list(PageRequestParams.of(1, 20, ""), null, null))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("平台管理员");
    }

    @Test
    void adminCanListAuditLogsWithPaginationAndFilters() {
        TestSecurity.login(1L, 1L, "admin@example.com", "管理员", "USER", "ADMIN");
        AuditLog auditLog = new AuditLog();
        auditLog.setId(100L);
        auditLog.setTenantId(1L);
        auditLog.setUserId(1L);
        auditLog.setAction("KNOWLEDGE_BASE_CREATE");
        auditLog.setTargetType("KNOWLEDGE_BASE");
        auditLog.setTargetId(200L);
        auditLog.setDetail("创建知识库");
        auditLog.setCreatedAt(Instant.parse("2026-07-20T00:00:00Z"));
        when(auditLogMapper.countPage(false, 1L, "KNOWLEDGE_BASE_CREATE", "客服")).thenReturn(1L);
        when(auditLogMapper.selectPage(false, 1L, "KNOWLEDGE_BASE_CREATE", "客服", 10, 0)).thenReturn(List.of(auditLog));

        PageResponse<?> response = service.list(PageRequestParams.of(1, 10, "客服"), 1L, "KNOWLEDGE_BASE_CREATE");

        assertThat(response.total()).isEqualTo(1);
        assertThat(response.items()).hasSize(1);
        verify(auditLogMapper).selectPage(eq(false), eq(1L), eq("KNOWLEDGE_BASE_CREATE"), eq("客服"), eq(10), eq(0));
    }
}
