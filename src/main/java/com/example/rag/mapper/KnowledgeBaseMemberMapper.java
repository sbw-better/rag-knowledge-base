package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.KnowledgeBaseMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface KnowledgeBaseMemberMapper extends BaseMapper<KnowledgeBaseMember> {
    @Select("select count(1) from knowledge_base_members where knowledge_base_id = #{knowledgeBaseId} and user_id = #{userId}")
    int countByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);
}
