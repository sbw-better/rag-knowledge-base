package com.example.rag.knowledge;

import com.example.rag.auth.CurrentUser;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.common.NotFoundException;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import com.example.rag.dto.ApiDtos;
import com.example.rag.repository.KnowledgeBaseMemberRepository;
import com.example.rag.repository.KnowledgeBaseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class KnowledgeBaseService {
    public KnowledgeBaseService(KnowledgeBaseRepository knowledgeBaseRepository, KnowledgeBaseMemberRepository memberRepository) {
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.memberRepository = memberRepository;
    }

    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KnowledgeBaseMemberRepository memberRepository;

    @Transactional
    public ApiDtos.KnowledgeBaseResponse create(ApiDtos.KnowledgeBaseRequest request) {
        UserAccount user = CurrentUser.required();
        KnowledgeBase kb = new KnowledgeBase();
        kb.setTenant(user.getTenant());
        kb.setOwner(user);
        apply(kb, request);
        return toResponse(knowledgeBaseRepository.save(kb));
    }

    public List<ApiDtos.KnowledgeBaseResponse> list() {
        UserAccount user = CurrentUser.required();
        return knowledgeBaseRepository.findByTenant_IdAndDeletedFalseOrderByCreatedAtDesc(user.getTenant().getId())
                .stream()
                .filter(kb -> canAccess(kb, user))
                .map(this::toResponse)
                .toList();
    }

    public ApiDtos.KnowledgeBaseResponse get(UUID id) {
        return toResponse(requireAccess(id));
    }

    @Transactional
    public ApiDtos.KnowledgeBaseResponse update(UUID id, ApiDtos.KnowledgeBaseRequest request) {
        KnowledgeBase kb = requireAccess(id);
        if (!isOwnerOrAdmin(kb, CurrentUser.required())) {
            throw new ForbiddenException("Only owner or admin can update knowledge base");
        }
        apply(kb, request);
        return toResponse(kb);
    }

    @Transactional
    public void delete(UUID id) {
        KnowledgeBase kb = requireAccess(id);
        if (!isOwnerOrAdmin(kb, CurrentUser.required())) {
            throw new ForbiddenException("Only owner or admin can delete knowledge base");
        }
        kb.setDeleted(true);
    }

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

    private void apply(KnowledgeBase kb, ApiDtos.KnowledgeBaseRequest request) {
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

    public ApiDtos.KnowledgeBaseResponse toResponse(KnowledgeBase kb) {
        return new ApiDtos.KnowledgeBaseResponse(
                kb.getId(),
                kb.getName(),
                kb.getDescription(),
                kb.getChunkSize(),
                kb.getChunkOverlap(),
                kb.getTopK(),
                kb.getCreatedAt());
    }
}
