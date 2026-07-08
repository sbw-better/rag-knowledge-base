package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Conversation;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ConversationMapper extends BaseMapper<Conversation> {
    @Select("select * from conversations where id = #{id} and tenant_id = #{tenantId} and user_id = #{userId} limit 1")
    Conversation selectByIdAndTenantIdAndUserId(@Param("id") Long id, @Param("tenantId") Long tenantId, @Param("userId") Long userId);
}
