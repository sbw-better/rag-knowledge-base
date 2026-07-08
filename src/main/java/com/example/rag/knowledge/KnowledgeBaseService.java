package com.example.rag.knowledge;

import com.example.rag.auth.CurrentUser;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.NotFoundException;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import com.example.rag.knowledge.dto.KnowledgeBaseRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseResponse;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.KnowledgeBaseMemberMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 知识库应用服务。
 *
 * <p>该服务集中处理知识库 CRUD 和访问权限判断。当前版本支持 owner、ADMIN 和
 * knowledge_base_members 预留成员权限，后续扩展团队协作时应优先复用这里的
 * {@link #requireAccess(Long)} 作为统一入口。</p>
 */
@Service
public class KnowledgeBaseService {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseService.class);

    public KnowledgeBaseService(KnowledgeBaseMapper knowledgeBaseMapper, KnowledgeBaseMemberMapper memberMapper) {
        this.knowledgeBaseMapper = knowledgeBaseMapper;
        this.memberMapper = memberMapper;
    }

    private final KnowledgeBaseMapper knowledgeBaseMapper;
    private final KnowledgeBaseMemberMapper memberMapper;

    @Transactional
    public KnowledgeBaseResponse create(KnowledgeBaseRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = new KnowledgeBase();
        kb.setTenantId(user.getTenantId());
        kb.setOwnerId(user.getId());
        apply(kb, request);
        knowledgeBaseMapper.insert(kb);
        log.info("Knowledge base created. tenantId={}, ownerId={}, knowledgeBaseId={}, name={}",
                user.getTenantId(), user.getId(), kb.getId(), kb.getName());
        return toResponse(kb);
    }

    /**
     * 列出当前用户可访问的知识库。第一版会先按租户查出未删除知识库，再做 owner/admin/member 过滤。
     */
    public List<KnowledgeBaseResponse> list() {
        UserAccount user = CurrentUser.required();
        List<KnowledgeBaseResponse> result = knowledgeBaseMapper.selectVisibleByTenantId(user.getTenantId())
                .stream()
                .filter(kb -> canAccess(kb, user))
                .map(this::toResponse)
                .toList();
        log.debug("Knowledge bases listed. tenantId={}, userId={}, count={}",
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
        if (!isOwnerOrAdmin(kb, user)) {
            throw new ForbiddenException("Only owner or admin can update knowledge base");
        }
        apply(kb, request);
        knowledgeBaseMapper.updateById(kb);
        log.info("Knowledge base updated. tenantId={}, userId={}, knowledgeBaseId={}",
                kb.getTenantId(), user.getId(), kb.getId());
        return toResponse(kb);
    }

    @Transactional
    public void delete(Long id) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!isOwnerOrAdmin(kb, user)) {
            throw new ForbiddenException("Only owner or admin can delete knowledge base");
        }
        kb.setDeleted(true);
        knowledgeBaseMapper.updateById(kb);
        log.info("Knowledge base deleted. tenantId={}, userId={}, knowledgeBaseId={}",
                kb.getTenantId(), user.getId(), kb.getId());
    }

    /**
     * 查询知识库并校验当前用户是否有访问权限。所有文档、检索、问答入口都应复用该方法。
     */
    public KnowledgeBase requireAccess(Long id) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseMapper.selectByIdAndTenantIdNotDeleted(id, user.getTenantId());
        if (kb == null) {
            throw new NotFoundException("Knowledge base not found");
        }
        if (!canAccess(kb, user)) {
            throw new ForbiddenException("No access to knowledge base");
        }
        return kb;
    }

    private boolean canAccess(KnowledgeBase kb, UserAccount user) {
        return isOwnerOrAdmin(kb, user)
                || memberMapper.countByKnowledgeBaseIdAndUserId(kb.getId(), user.getId()) > 0;
    }

    private boolean isOwnerOrAdmin(KnowledgeBase kb, UserAccount user) {
        return kb.getOwnerId().equals(user.getId())
                || user.getRoles().stream().map(Role::getName).anyMatch("ADMIN"::equals);
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
        if (kb.getChunkOverlap() >= kb.getChunkSize()) {
            throw new BadRequestException("chunkOverlap must be smaller than chunkSize");
        }
    }

    public KnowledgeBaseResponse toResponse(KnowledgeBase kb) {
        return new KnowledgeBaseResponse(
                kb.getId().toString(),
                kb.getName(),
                kb.getDescription(),
                kb.getChunkSize(),
                kb.getChunkOverlap(),
                kb.getTopK(),
                kb.getCreatedAt());
    }
}
