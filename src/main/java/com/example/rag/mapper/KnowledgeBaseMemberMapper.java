package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.KnowledgeBaseMember;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface KnowledgeBaseMemberMapper extends BaseMapper<KnowledgeBaseMember> {
    int countByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);

    List<KnowledgeBaseMember> selectByKnowledgeBaseId(@Param("knowledgeBaseId") Long knowledgeBaseId);

    KnowledgeBaseMember selectByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);

    int deleteByKnowledgeBaseIdAndUserId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("userId") Long userId);
}
