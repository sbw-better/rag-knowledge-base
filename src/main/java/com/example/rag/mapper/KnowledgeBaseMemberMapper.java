package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.KnowledgeBaseMember;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface KnowledgeBaseMemberMapper extends BaseMapper<KnowledgeBaseMember> {
    @Select("select count(1) from knowledge_base_members where knowledge_base_id = #{knowledgeBaseId} and user_id = #{userId}")
    int countByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);

    @Select("select * from knowledge_base_members where knowledge_base_id = #{knowledgeBaseId} order by created_at desc")
    List<KnowledgeBaseMember> selectByKnowledgeBaseId(Long knowledgeBaseId);

    @Select("select * from knowledge_base_members where knowledge_base_id = #{knowledgeBaseId} and user_id = #{userId} limit 1")
    KnowledgeBaseMember selectByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);

    @Delete("delete from knowledge_base_members where knowledge_base_id = #{knowledgeBaseId} and user_id = #{userId}")
    int deleteByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);
}
