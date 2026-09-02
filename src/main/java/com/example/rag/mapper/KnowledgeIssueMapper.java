package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.KnowledgeIssue;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface KnowledgeIssueMapper extends BaseMapper<KnowledgeIssue> {
    long countByKnowledgeBaseIdAndStatus(@Param("tenantId") Long tenantId,
                                         @Param("knowledgeBaseId") Long knowledgeBaseId,
                                         @Param("status") String status,
                                         @Param("keyword") String keyword);

    List<KnowledgeIssue> selectPageByKnowledgeBaseIdAndStatus(@Param("tenantId") Long tenantId,
                                                              @Param("knowledgeBaseId") Long knowledgeBaseId,
                                                              @Param("status") String status,
                                                              @Param("keyword") String keyword,
                                                              @Param("limit") int limit,
                                                              @Param("offset") int offset);
}
