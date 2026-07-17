package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Conversation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
    @Select("select * from conversations where id = #{id} and tenant_id = #{tenantId} and user_id = #{userId} limit 1")
    Conversation selectByIdAndTenantIdAndUserId(@Param("id") Long id, @Param("tenantId") Long tenantId, @Param("userId") Long userId);

    @Select("""
            select *
            from conversations
            where tenant_id = #{tenantId}
              and user_id = #{userId}
              and knowledge_base_id = #{knowledgeBaseId}
            order by updated_at desc, created_at desc
            limit 1
            """)
    Conversation selectLatestByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                               @Param("userId") Long userId,
                                               @Param("knowledgeBaseId") Long knowledgeBaseId);

    @Select("""
            select *
            from conversations
            where tenant_id = #{tenantId}
              and user_id = #{userId}
              and knowledge_base_id = #{knowledgeBaseId}
            order by updated_at desc, created_at desc
            limit #{limit}
            """)
    List<Conversation> selectByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                               @Param("userId") Long userId,
                                               @Param("knowledgeBaseId") Long knowledgeBaseId,
                                               @Param("limit") int limit);
}
