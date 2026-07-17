package com.example.rag.knowledge;

import com.example.rag.auth.CurrentUser;
import com.example.rag.auth.dto.AdminUserResponse;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.Ids;
import com.example.rag.common.NotFoundException;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.KnowledgeBaseMember;
import com.example.rag.domain.KbPermission;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import com.example.rag.knowledge.dto.KnowledgeBaseRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseMemberRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseMemberResponse;
import com.example.rag.knowledge.dto.KnowledgeBaseResponse;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.KnowledgeBaseMemberMapper;
import com.example.rag.mapper.UserMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;

/**
 * 知识库应用服务。
 *
 * <p>该服务集中处理知识库 CRUD 和访问权限判断。当前版本把系统角色和资源身份分开：
 * ADMIN 是平台管理员，KB_MANAGER 只能创建知识库，创建者会成为该知识库 owner；
 * knowledge_base_members 负责把知识库授权给普通用户。后续扩展团队协作时应优先复用这里的
 * {@link #requireAccess(Long)} 作为统一入口。</p>
 */
@Service
public class KnowledgeBaseService {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseService.class);

    public KnowledgeBaseService(KnowledgeBaseMapper knowledgeBaseMapper,
                                KnowledgeBaseMemberMapper memberMapper,
                                UserMapper userMapper) {
        this.knowledgeBaseMapper = knowledgeBaseMapper;
        this.memberMapper = memberMapper;
        this.userMapper = userMapper;
    }

    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final KnowledgeBaseMemberMapper memberMapper;
    private final UserMapper userMapper;

    @Transactional
    public KnowledgeBaseResponse create(KnowledgeBaseRequest request) {
        UserAccount user = CurrentUser.required();
        if (!canCreateKnowledgeBase(user)) {
            throw new ForbiddenException("只有平台管理员或知识库管理员可以创建知识库");
        }
        KnowledgeBase kb = new KnowledgeBase();
        kb.setTenantId(user.getTenantId());
        kb.setOwnerId(user.getId());
        apply(kb, request);
        knowledgeBaseMapper.insert(kb);
        log.info("知识库创建成功。tenantId={}, ownerId={}, knowledgeBaseId={}, name={}",
                user.getTenantId(), user.getId(), kb.getId(), kb.getName());
        return toResponse(kb);
    }

    /**
     * 列出当前用户可访问的知识库。会先按租户查出未删除知识库，再做 owner、ADMIN、成员授权过滤。
     * 普通 USER 没有被授权时看不到任何知识库。
     */
    public List<KnowledgeBaseResponse> list() {
        UserAccount user = CurrentUser.required();
        List<KnowledgeBaseResponse> result = knowledgeBaseMapper.selectVisibleByTenantId(user.getTenantId())
                .stream()
                .filter(kb -> canAccess(kb, user))
                .map(this::toResponse)
                .toList();
        log.debug("知识库列表查询完成。tenantId={}, userId={}, count={}",
                user.getTenantId(), user.getId(), result.size());
        return result;
    }

    public KnowledgeBaseResponse get(Long id) {
        return toResponse(requireAccess(id));
    }

    @Transactional
    public KnowledgeBaseResponse update(Long id, KnowledgeBaseRequest request) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!canManageKnowledgeBase(kb, user)) {
            throw new ForbiddenException("只有负责人、平台管理员或知识库管理员可以修改知识库");
        }
        apply(kb, request);
        knowledgeBaseMapper.updateById(kb);
        log.info("知识库已更新。tenantId={}, userId={}, knowledgeBaseId={}",
                kb.getTenantId(), user.getId(), kb.getId());
        return toResponse(kb);
    }

    @Transactional
    public void delete(Long id) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!isOwnerOrAdmin(kb, user)) {
            throw new ForbiddenException("只有负责人或平台管理员可以删除知识库");
        }
        kb.setDeleted(true);
        knowledgeBaseMapper.updateById(kb);
        log.info("知识库已删除。tenantId={}, userId={}, knowledgeBaseId={}",
                kb.getTenantId(), user.getId(), kb.getId());
    }

    /**
     * 查询知识库并校验当前用户是否有访问权限。所有文档、检索、问答入口都应复用该方法。
     */
    public KnowledgeBase requireAccess(Long id) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseMapper.selectByIdAndTenantIdNotDeleted(id, user.getTenantId());
        if (kb == null) {
            throw new NotFoundException("知识库不存在");
        }
        if (!canAccess(kb, user)) {
            throw new ForbiddenException("没有访问该知识库的权限");
        }
        return kb;
    }

    /**
     * 查询知识库并校验当前用户是否拥有知识库管理权限。
     *
     * <p>该权限用于成员授权、配置修改、重建索引等管理动作。文档维护使用
     * {@link #requireContentManageAccess(Long)}，删除知识库仍只允许 owner 或 ADMIN。</p>
     */
    public KnowledgeBase requireManageAccess(Long id) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!canManageKnowledgeBase(kb, user)) {
            throw new ForbiddenException("只有负责人、平台管理员或知识库管理员可以管理该知识库");
        }
        return kb;
    }

    /**
     * 校验当前用户是否可以维护知识库内容，例如上传文档、查看文档任务和调试检索。
     */
    public KnowledgeBase requireContentManageAccess(Long id) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!canManageContent(kb, user)) {
            throw new ForbiddenException("只有资料维护成员、知识库管理员、负责人或平台管理员可以维护知识库内容");
        }
        return kb;
    }

    public List<KnowledgeBaseMemberResponse> listMembers(Long knowledgeBaseId) {
        KnowledgeBase kb = requireManageAccess(knowledgeBaseId);
        return memberMapper.selectByKnowledgeBaseId(kb.getId()).stream()
                .filter(member -> isAssignableMember(kb, loadUserWithRoles(member.getUserId())))
                .map(this::toMemberResponse)
                .toList();
    }

    public List<AdminUserResponse> listMemberCandidates(Long knowledgeBaseId) {
        KnowledgeBase kb = requireManageAccess(knowledgeBaseId);
        return userMapper.selectByTenantId(kb.getTenantId()).stream()
                .peek(user -> user.setRoles(new HashSet<>(userMapper.selectRolesByUserId(user.getId()))))
                .filter(user -> isAssignableMember(kb, user))
                .map(this::toUserResponse)
                .toList();
    }

    @Transactional
    public KnowledgeBaseMemberResponse saveMember(Long knowledgeBaseId, KnowledgeBaseMemberRequest request) {
        KnowledgeBase kb = requireManageAccess(knowledgeBaseId);
        Long userId = Ids.parse(request.userId(), "userId");
        UserAccount targetUser = userMapper.selectById(userId);
        if (targetUser == null || !targetUser.getTenantId().equals(kb.getTenantId())) {
            throw new NotFoundException("用户不存在");
        }
        targetUser.setRoles(new HashSet<>(userMapper.selectRolesByUserId(targetUser.getId())));
        if (targetUser.getId().equals(kb.getOwnerId())) {
            throw new BadRequestException("知识库负责人已经拥有完整权限");
        }
        if (isAdmin(targetUser)) {
            throw new BadRequestException("ADMIN 已拥有平台级权限，不需要单独分配知识库成员权限");
        }
        if (request.permission() == KbPermission.OWNER) {
            throw new BadRequestException("OWNER 权限不能手动分配");
        }

        KnowledgeBaseMember member = memberMapper.selectByKnowledgeBaseIdAndUserId(kb.getId(), userId);
        if (member == null) {
            member = new KnowledgeBaseMember();
            member.setKnowledgeBaseId(kb.getId());
            member.setUserId(userId);
            member.setPermission(request.permission());
            memberMapper.insert(member);
            log.info("知识库成员已添加。knowledgeBaseId={}, userId={}, permission={}",
                    kb.getId(), userId, request.permission());
        } else {
            member.setPermission(request.permission());
            memberMapper.updateById(member);
            log.info("知识库成员权限已更新。knowledgeBaseId={}, userId={}, permission={}",
                    kb.getId(), userId, request.permission());
        }
        return toMemberResponse(member);
    }

    @Transactional
    public void removeMember(Long knowledgeBaseId, Long userId) {
        KnowledgeBase kb = requireManageAccess(knowledgeBaseId);
        if (kb.getOwnerId().equals(userId)) {
            throw new BadRequestException("不能移除知识库负责人的权限");
        }
        int deleted = memberMapper.deleteByKnowledgeBaseIdAndUserId(kb.getId(), userId);
        if (deleted == 0) {
            throw new NotFoundException("知识库成员不存在");
        }
        log.info("知识库成员已移除。knowledgeBaseId={}, userId={}", kb.getId(), userId);
    }

    private boolean canAccess(KnowledgeBase kb, UserAccount user) {
        return isOwnerOrAdmin(kb, user)
                || memberMapper.countByKnowledgeBaseIdAndUserId(kb.getId(), user.getId()) > 0;
    }

    private boolean isOwnerOrAdmin(KnowledgeBase kb, UserAccount user) {
        return kb.getOwnerId().equals(user.getId()) || isAdmin(user);
    }

    private boolean isAdmin(UserAccount user) {
        return user.getRoles().stream().map(Role::getName).anyMatch("ADMIN"::equals);
    }

    private boolean canManageContent(KnowledgeBase kb, UserAccount user) {
        return isOwnerOrAdmin(kb, user) || hasMemberPermission(kb, user, KbPermission.EDITOR, KbPermission.MANAGER);
    }

    private boolean canManageKnowledgeBase(KnowledgeBase kb, UserAccount user) {
        return isOwnerOrAdmin(kb, user) || hasMemberPermission(kb, user, KbPermission.MANAGER);
    }

    private boolean hasMemberPermission(KnowledgeBase kb, UserAccount user, KbPermission... allowedPermissions) {
        KnowledgeBaseMember member = memberMapper.selectByKnowledgeBaseIdAndUserId(kb.getId(), user.getId());
        if (member == null) {
            return false;
        }
        for (KbPermission permission : allowedPermissions) {
            if (member.getPermission() == permission) {
                return true;
            }
        }
        return false;
    }

    private String effectivePermission(KnowledgeBase kb, UserAccount user) {
        if (isAdmin(user)) {
            return "ADMIN";
        }
        if (kb.getOwnerId().equals(user.getId())) {
            return "OWNER";
        }
        KnowledgeBaseMember member = memberMapper.selectByKnowledgeBaseIdAndUserId(kb.getId(), user.getId());
        return member == null ? "NONE" : member.getPermission().name();
    }

    private boolean isAssignableMember(KnowledgeBase kb, UserAccount user) {
        return user != null
                && user.isEnabled()
                && user.getTenantId().equals(kb.getTenantId())
                && !user.getId().equals(kb.getOwnerId())
                && !isAdmin(user);
    }

    private UserAccount loadUserWithRoles(Long userId) {
        UserAccount user = userMapper.selectById(userId);
        if (user != null) {
            user.setRoles(new HashSet<>(userMapper.selectRolesByUserId(user.getId())));
        }
        return user;
    }

    private boolean canCreateKnowledgeBase(UserAccount user) {
        return user.getRoles().stream()
                .map(Role::getName)
                .anyMatch(role -> "ADMIN".equals(role) || "KB_MANAGER".equals(role));
    }

    private void apply(KnowledgeBase kb, KnowledgeBaseRequest request) {
        kb.setName(request.name().trim());
        kb.setDescription(request.description());
        if (request.chunkSize() != null) {
            kb.setChunkSize(request.chunkSize());
        }
        if (request.chunkOverlap() != null) {
            kb.setChunkOverlap(request.chunkOverlap());
        }
        if (request.topK() != null) {
            kb.setTopK(request.topK());
        }
        if (request.minScore() != null) {
            kb.setMinScore(request.minScore());
        }
        if (kb.getChunkOverlap() >= kb.getChunkSize()) {
            throw new BadRequestException("chunkOverlap 必须小于 chunkSize");
        }
    }

    public KnowledgeBaseResponse toResponse(KnowledgeBase kb) {
        UserAccount user = CurrentUser.required();
        boolean canManageContent = canManageContent(kb, user);
        boolean canManageKnowledgeBase = canManageKnowledgeBase(kb, user);
        boolean canDelete = isOwnerOrAdmin(kb, user);
        return new KnowledgeBaseResponse(
                kb.getId().toString(),
                kb.getName(),
                kb.getDescription(),
                kb.getChunkSize(),
                kb.getChunkOverlap(),
                kb.getTopK(),
                kb.getMinScore(),
                kb.getCreatedAt(),
                canManageContent || canManageKnowledgeBase || canDelete,
                effectivePermission(kb, user),
                canManageContent,
                canManageKnowledgeBase,
                canManageKnowledgeBase,
                canManageKnowledgeBase,
                canDelete);
    }

    private KnowledgeBaseMemberResponse toMemberResponse(KnowledgeBaseMember member) {
        UserAccount user = userMapper.selectById(member.getUserId());
        return new KnowledgeBaseMemberResponse(
                member.getId().toString(),
                member.getUserId().toString(),
                user == null ? "" : user.getEmail(),
                user == null ? "未知用户" : user.getDisplayName(),
                member.getPermission().name(),
                member.getCreatedAt());
    }

    private AdminUserResponse toUserResponse(UserAccount user) {
        return new AdminUserResponse(
                user.getId().toString(),
                user.getEmail(),
                user.getDisplayName(),
                user.isEnabled(),
                user.getRoles().stream().map(Role::getName).sorted().toList(),
                user.getCreatedAt());
    }
}
