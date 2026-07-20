package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Conversation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
    Conversation selectByIdAndTenantIdAndUserId(@Param("id") Long id, @Param("tenantId") Long tenantId, @Param("userId") Long userId);

    Conversation selectLatestByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                               @Param("userId") Long userId,
                                               @Param("knowledgeBaseId") Long knowledgeBaseId);

    List<Conversation> selectByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                               @Param("userId") Long userId,
                                               @Param("knowledgeBaseId") Long knowledgeBaseId,
                                               @Param("limit") int limit);

    List<Conversation> selectPageByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                                   @Param("userId") Long userId,
                                                   @Param("knowledgeBaseId") Long knowledgeBaseId,
                                                   @Param("keyword") String keyword,
                                                   @Param("limit") int limit,
                                                   @Param("offset") int offset);

    long countByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                @Param("userId") Long userId,
                                @Param("knowledgeBaseId") Long knowledgeBaseId,
                                @Param("keyword") String keyword);
}
