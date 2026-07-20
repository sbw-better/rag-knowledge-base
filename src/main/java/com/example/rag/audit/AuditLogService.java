package com.example.rag.audit;

import com.example.rag.audit.dto.AuditLogResponse;
import com.example.rag.auth.CurrentUser;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import com.example.rag.domain.AuditLog;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import com.example.rag.mapper.AuditLogMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 审计日志服务。
 *
 * <p>业务服务调用 {@link #record(UserAccount, String, String, Long, String)} 记录关键动作；
 * 管理页面调用 {@link #list(PageRequestParams, Long, String)} 分页查询审计记录。</p>
 */
@Service
public class AuditLogService {
    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogMapper auditLogMapper;

    public AuditLogService(AuditLogMapper auditLogMapper) {
        this.auditLogMapper = auditLogMapper;
    }

    /**
     * 记录当前登录用户发起的管理动作。
     *
     * <p>审计日志不能影响主业务，所以这里捕获所有异常并写入应用日志。</p>
     */
    public void record(UserAccount operator, String action, String targetType, Long targetId, String detail) {
        if (operator == null) {
            return;
        }
        try {
            AuditLog auditLog = new AuditLog();
            auditLog.setTenantId(operator.getTenantId());
            auditLog.setUserId(operator.getId());
            auditLog.setAction(action);
            auditLog.setTargetType(targetType);
            auditLog.setTargetId(targetId);
            auditLog.setDetail(detail);
            auditLogMapper.insert(auditLog);
        } catch (Exception ex) {
            log.error("审计日志写入失败。userId={}, action={}, targetType={}, targetId={}",
                    operator.getId(), action, targetType, targetId, ex);
        }
    }

    /**
     * 分页查询审计日志。当前版本仅 ADMIN 可以查看。
     */
    public PageResponse<AuditLogResponse> list(PageRequestParams params, Long tenantId, String action) {
        UserAccount current = CurrentUser.required();
        requireAdmin(current);
        String safeAction = action == null ? "" : action.trim();
        boolean allTenants = tenantId == null;
        long safeTenantId = tenantId == null ? 0L : tenantId;
        long total = auditLogMapper.countPage(allTenants, safeTenantId, safeAction, params.keyword());
        return PageResponse.of(
                auditLogMapper.selectPage(allTenants, safeTenantId, safeAction, params.keyword(), params.pageSize(), params.offset())
                        .stream()
                        .map(AuditLogService::toResponse)
                        .toList(),
                params.page(),
                params.pageSize(),
                total);
    }

    private static AuditLogResponse toResponse(AuditLog auditLog) {
        return new AuditLogResponse(
                auditLog.getId().toString(),
                auditLog.getTenantId() == null ? null : auditLog.getTenantId().toString(),
                auditLog.getUserId() == null ? null : auditLog.getUserId().toString(),
                auditLog.getAction(),
                auditLog.getTargetType(),
                auditLog.getTargetId() == null ? null : auditLog.getTargetId().toString(),
                auditLog.getDetail(),
                auditLog.getCreatedAt());
    }

    private static void requireAdmin(UserAccount user) {
        boolean admin = user.getRoles().stream().map(Role::getName).anyMatch("ADMIN"::equals);
        if (!admin) {
            throw new ForbiddenException("只有平台管理员可以查看审计日志");
        }
    }
}
