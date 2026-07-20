package com.example.rag;

import com.example.rag.audit.AuditLogService;
import com.example.rag.common.BadRequestException;
import com.example.rag.common.ForbiddenException;
import com.example.rag.domain.KbPermission;
import com.example.rag.domain.KnowledgeBase;
import com.example.rag.domain.KnowledgeBaseMember;
import com.example.rag.domain.UserAccount;
import com.example.rag.knowledge.KnowledgeBaseService;
import com.example.rag.knowledge.dto.KnowledgeBaseMemberRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseRequest;
import com.example.rag.knowledge.dto.KnowledgeBaseResponse;
import com.example.rag.mapper.KnowledgeBaseMapper;
import com.example.rag.mapper.KnowledgeBaseMemberMapper;
import com.example.rag.mapper.UserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.core.context.SecurityContextHolder.clearContext;

class KnowledgeBaseServicePermissionTest {
    private final KnowledgeBaseMapper knowledgeBaseMapper = mock(KnowledgeBaseMapper.class);
    private final KnowledgeBaseMemberMapper memberMapper = mock(KnowledgeBaseMemberMapper.class);
    private final UserMapper userMapper = mock(UserMapper.class);
    private final AuditLogService auditLogService = mock(AuditLogService.class);

    private KnowledgeBaseService service;

    @BeforeEach
    void setUp() {
        service = new KnowledgeBaseService(knowledgeBaseMapper, memberMapper, userMapper, auditLogService);
    }

    @AfterEach
    void tearDown() {
        clearContext();
    }

    @Test
    void normalUserCannotCreateKnowledgeBase() {
        TestSecurity.login(10L, 1L, "user@example.com", "普通用户", "USER");

        assertThatThrownBy(() -> service.create(request()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("知识库管理员");
        verify(knowledgeBaseMapper, never()).insert(any(KnowledgeBase.class));
    }

    @Test
    void kbManagerCanCreateKnowledgeBaseAndBecomesOwner() {
        UserAccount manager = TestSecurity.login(11L, 1L, "manager@example.com", "知识库管理员", "USER", "KB_MANAGER");
        doAnswer(invocation -> {
            KnowledgeBase kb = invocation.getArgument(0);
            kb.setId(200L);
            return 1;
        }).when(knowledgeBaseMapper).insert(any(KnowledgeBase.class));

        KnowledgeBaseResponse response = service.create(request());

        assertThat(response.id()).isEqualTo("200");
        verify(knowledgeBaseMapper).insert(any(KnowledgeBase.class));
        verify(auditLogService).record(eq(manager), eq("KNOWLEDGE_BASE_CREATE"), eq("KNOWLEDGE_BASE"), eq(200L), any());
    }

    @Test
    void adminCanAccessAnyKnowledgeBaseInSameTenantWithoutMemberRecord() {
        TestSecurity.login(1L, 1L, "admin@example.com", "管理员", "USER", "ADMIN");
        KnowledgeBase kb = kb(300L, 1L, 99L);
        when(knowledgeBaseMapper.selectByIdAndTenantIdNotDeleted(300L, 1L)).thenReturn(kb);

        KnowledgeBaseResponse response = service.get(300L);

        assertThat(response.permission()).isEqualTo("ADMIN");
        assertThat(response.canManageMembers()).isTrue();
        verify(memberMapper, never()).countByKnowledgeBaseIdAndUserId(300L, 1L);
    }

    @Test
    void viewerCanAccessButCannotManageContent() {
        TestSecurity.login(20L, 1L, "viewer@example.com", "只问答用户", "USER");
        KnowledgeBase kb = kb(400L, 1L, 99L);
        when(knowledgeBaseMapper.selectByIdAndTenantIdNotDeleted(400L, 1L)).thenReturn(kb);
        when(memberMapper.countByKnowledgeBaseIdAndUserId(400L, 20L)).thenReturn(1);
        when(memberMapper.selectByKnowledgeBaseIdAndUserId(400L, 20L)).thenReturn(member(400L, 20L, KbPermission.VIEWER));

        KnowledgeBaseResponse response = service.get(400L);

        assertThat(response.permission()).isEqualTo("VIEWER");
        assertThat(response.canManageDocuments()).isFalse();
        assertThatThrownBy(() -> service.requireContentManageAccess(400L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("维护知识库内容");
    }

    @Test
    void editorCanManageContentButCannotManageMembers() {
        TestSecurity.login(21L, 1L, "editor@example.com", "资料维护", "USER");
        KnowledgeBase kb = kb(401L, 1L, 99L);
        when(knowledgeBaseMapper.selectByIdAndTenantIdNotDeleted(401L, 1L)).thenReturn(kb);
        when(memberMapper.countByKnowledgeBaseIdAndUserId(401L, 21L)).thenReturn(1);
        when(memberMapper.selectByKnowledgeBaseIdAndUserId(401L, 21L)).thenReturn(member(401L, 21L, KbPermission.EDITOR));

        assertThat(service.requireContentManageAccess(401L)).isSameAs(kb);
        assertThatThrownBy(() -> service.requireManageAccess(401L))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("管理该知识库");
    }

    @Test
    void managerCanGrantNormalUserButCannotGrantAdminOrOwnerPermission() {
        UserAccount operator = TestSecurity.login(22L, 1L, "manager@example.com", "成员管理员", "USER");
        KnowledgeBase kb = kb(500L, 1L, 99L);
        UserAccount target = TestSecurity.user(23L, 1L, "target@example.com", "待授权用户", "USER");
        when(knowledgeBaseMapper.selectByIdAndTenantIdNotDeleted(500L, 1L)).thenReturn(kb);
        when(memberMapper.countByKnowledgeBaseIdAndUserId(500L, 22L)).thenReturn(1);
        when(memberMapper.selectByKnowledgeBaseIdAndUserId(500L, 22L)).thenReturn(member(500L, 22L, KbPermission.MANAGER));
        when(userMapper.selectById(23L)).thenReturn(target);
        when(userMapper.selectRolesByUserId(23L)).thenReturn(List.of(TestSecurity.role("USER")));
        doAnswer(invocation -> {
            KnowledgeBaseMember member = invocation.getArgument(0);
            member.setId(700L);
            return 1;
        }).when(memberMapper).insert(any(KnowledgeBaseMember.class));

        assertThat(service.saveMember(500L, new KnowledgeBaseMemberRequest("23", KbPermission.VIEWER)).permission())
                .isEqualTo("VIEWER");
        verify(auditLogService).record(eq(operator), eq("KNOWLEDGE_BASE_MEMBER_SAVE"), eq("KNOWLEDGE_BASE"), eq(500L), any());

        UserAccount admin = TestSecurity.user(24L, 1L, "admin@example.com", "管理员", "USER", "ADMIN");
        when(userMapper.selectById(24L)).thenReturn(admin);
        when(userMapper.selectRolesByUserId(24L)).thenReturn(List.of(TestSecurity.role("USER"), TestSecurity.role("ADMIN")));
        assertThatThrownBy(() -> service.saveMember(500L, new KnowledgeBaseMemberRequest("24", KbPermission.VIEWER)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("ADMIN 已拥有平台级权限");

        assertThatThrownBy(() -> service.saveMember(500L, new KnowledgeBaseMemberRequest("23", KbPermission.OWNER)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("OWNER 权限不能手动分配");
    }

    private static KnowledgeBaseRequest request() {
        return new KnowledgeBaseRequest("客服知识库", "回答客户问题", 300, 50, 5, 0.2);
    }

    private static KnowledgeBase kb(long id, long tenantId, long ownerId) {
        KnowledgeBase kb = new KnowledgeBase();
        kb.setId(id);
        kb.setTenantId(tenantId);
        kb.setOwnerId(ownerId);
        kb.setName("测试知识库");
        kb.setDescription("测试说明");
        kb.setChunkSize(300);
        kb.setChunkOverlap(50);
        kb.setTopK(5);
        kb.setMinScore(0.2);
        return kb;
    }

    private static KnowledgeBaseMember member(long knowledgeBaseId, long userId, KbPermission permission) {
        KnowledgeBaseMember member = new KnowledgeBaseMember();
        member.setId(900L + userId);
        member.setKnowledgeBaseId(knowledgeBaseId);
        member.setUserId(userId);
        member.setPermission(permission);
        return member;
    }
}
