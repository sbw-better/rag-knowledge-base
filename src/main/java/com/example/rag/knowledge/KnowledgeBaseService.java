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
import com.example.rag.repository.KnowledgeBaseMemberRepository;
import com.example.rag.repository.KnowledgeBaseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 知识库应用服务。
 *
 * <p>该服务集中处理知识库 CRUD 和访问权限判断。当前版本支持 owner、ADMIN 和
 * knowledge_base_members 预留成员权限，后续扩展团队协作时应优先复用这里的
 * {@link #requireAccess(UUID)} 作为统一入口。</p>
 */
@Service
public class KnowledgeBaseService {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseService.class);

    public KnowledgeBaseService(KnowledgeBaseRepository knowledgeBaseRepository, KnowledgeBaseMemberRepository memberRepository) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.memberRepository = memberRepository;
    }

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KnowledgeBaseMemberRepository memberRepository;

    @Transactional
    public KnowledgeBaseResponse create(KnowledgeBaseRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = new KnowledgeBase();
        kb.setTenant(user.getTenant());
        kb.setOwner(user);
        apply(kb, request);
        KnowledgeBase saved = knowledgeBaseRepository.save(kb);
        log.info("Knowledge base created. tenantId={}, ownerId={}, knowledgeBaseId={}, name={}",
                user.getTenant().getId(), user.getId(), saved.getId(), saved.getName());
        return toResponse(saved);
    }

    /**
     * 列出当前用户可访问的知识库。第一版会先按租户查出未删除知识库，再做 owner/admin/member 过滤。
     */
    public List<KnowledgeBaseResponse> list() {
        UserAccount user = CurrentUser.required();
        List<KnowledgeBaseResponse> result = knowledgeBaseRepository.findByTenant_IdAndDeletedFalseOrderByCreatedAtDesc(user.getTenant().getId())
                .stream()
                .filter(kb -> canAccess(kb, user))
                .map(this::toResponse)
                .toList();
        log.debug("Knowledge bases listed. tenantId={}, userId={}, count={}",
                user.getTenant().getId(), user.getId(), result.size());
        return result;
    }

    public KnowledgeBaseResponse get(UUID id) {
        return toResponse(requireAccess(id));
    }

    @Transactional
    public KnowledgeBaseResponse update(UUID id, KnowledgeBaseRequest request) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!isOwnerOrAdmin(kb, user)) {
            throw new ForbiddenException("Only owner or admin can update knowledge base");
        }
        apply(kb, request);
        log.info("Knowledge base updated. tenantId={}, userId={}, knowledgeBaseId={}",
                kb.getTenant().getId(), user.getId(), kb.getId());
        return toResponse(kb);
    }

    @Transactional
    public void delete(UUID id) {
        KnowledgeBase kb = requireAccess(id);
        UserAccount user = CurrentUser.required();
        if (!isOwnerOrAdmin(kb, user)) {
            throw new ForbiddenException("Only owner or admin can delete knowledge base");
        }
        kb.setDeleted(true);
        log.info("Knowledge base deleted. tenantId={}, userId={}, knowledgeBaseId={}",
                kb.getTenant().getId(), user.getId(), kb.getId());
    }

    /**
     * 查询知识库并校验当前用户是否有访问权限。所有文档、检索、问答入口都应复用该方法。
     */
    public KnowledgeBase requireAccess(UUID id) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = knowledgeBaseRepository.findByIdAndTenant_IdAndDeletedFalse(id, user.getTenant().getId())
                .orElseThrow(() -> new NotFoundException("Knowledge base not found"));
        if (!canAccess(kb, user)) {
            throw new ForbiddenException("No access to knowledge base");
        }
        return kb;
    }

    private boolean canAccess(KnowledgeBase kb, UserAccount user) {
        return isOwnerOrAdmin(kb, user)
                || memberRepository.existsByKnowledgeBase_IdAndUser_Id(kb.getId(), user.getId());
    }

    private boolean isOwnerOrAdmin(KnowledgeBase kb, UserAccount user) {
        return kb.getOwner().getId().equals(user.getId())
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
                kb.getId(),
                kb.getName(),
                kb.getDescription(),
                kb.getChunkSize(),
                kb.getChunkOverlap(),
                kb.getTopK(),
                kb.getCreatedAt());
    }
}
