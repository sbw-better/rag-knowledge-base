package com.example.rag.tenant;

import com.example.rag.auth.CurrentUser;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.domain.Role;
import com.example.rag.domain.Tenant;
import com.example.rag.domain.UserAccount;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.TenantMapper;
import com.example.rag.mapper.UserMapper;
import com.example.rag.tenant.dto.TenantRequest;
import com.example.rag.tenant.dto.TenantResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 平台租户管理服务。
 *
 * <p>租户是数据隔离的第一层边界。当前系统中的用户、知识库、文档、任务、切片等核心表
 * 已经带有 tenant_id，本服务先补齐管理员可见的租户列表和租户创建能力。</p>
 */
@Service
public class TenantAdminService {
    private static final Logger log = LoggerFactory.getLogger(TenantAdminService.class);

    private final TenantMapper tenantMapper;
    private final UserMapper userMapper;
    private final KnowledgeBaseMapper knowledgeBaseMapper;

    public TenantAdminService(TenantMapper tenantMapper, UserMapper userMapper, KnowledgeBaseMapper knowledgeBaseMapper) {
        this.tenantMapper = tenantMapper;
        this.userMapper = userMapper;
        this.knowledgeBaseMapper = knowledgeBaseMapper;
    }

    /**
     * 查询平台内所有租户。第一版仅 ADMIN 可见，不按当前用户租户过滤。
     */
    public List<TenantResponse> listTenants() {
        UserAccount current = CurrentUser.required();
        requireAdmin(current);
        return tenantMapper.selectAllOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    /**
     * 创建租户。
     *
     * <p>创建租户不会自动迁移用户，也不会改变当前注册逻辑；后续会通过邀请或管理员创建用户
     * 把用户放入指定租户。</p>
     */
    @Transactional
    public TenantResponse createTenant(TenantRequest request) {
        UserAccount current = CurrentUser.required();
        requireAdmin(current);
        String name = request.name().trim();
        if (tenantMapper.selectByNameIgnoreCase(name) != null) {
            throw new BadRequestException("租户名称已存在");
        }
        Tenant tenant = new Tenant(name);
        tenantMapper.insert(tenant);
        Tenant saved = tenantMapper.selectById(tenant.getId());
        log.info("租户创建成功。operatorId={}, operatorTenantId={}, tenantId={}, tenantName={}",
                current.getId(), current.getTenantId(), tenant.getId(), tenant.getName());
        return toResponse(saved);
    }

    private TenantResponse toResponse(Tenant tenant) {
        return new TenantResponse(
                tenant.getId().toString(),
                tenant.getName(),
                userMapper.countByTenantId(tenant.getId()),
                knowledgeBaseMapper.countActiveByTenantId(tenant.getId()),
                tenant.getCreatedAt());
    }

    private static void requireAdmin(UserAccount user) {
        boolean admin = user.getRoles().stream().map(Role::getName).anyMatch("ADMIN"::equals);
        if (!admin) {
            throw new ForbiddenException("只有平台管理员可以管理租户");
        }
    }
}
