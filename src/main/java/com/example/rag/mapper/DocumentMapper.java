package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.DocumentEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DocumentMapper extends BaseMapper<DocumentEntity> {
    DocumentEntity selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    List<DocumentEntity> selectByKnowledgeBaseIdAndTenantId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("tenantId") Long tenantId);

    List<DocumentEntity> selectPageByKnowledgeBaseIdAndTenantId(@Param("knowledgeBaseId") Long knowledgeBaseId,
                                                                @Param("tenantId") Long tenantId,
                                                                @Param("keyword") String keyword,
                                                                @Param("limit") int limit,
                                                                @Param("offset") int offset);

    long countByKnowledgeBaseIdAndTenantId(@Param("knowledgeBaseId") Long knowledgeBaseId,
                                           @Param("tenantId") Long tenantId,
                                           @Param("keyword") String keyword);

    int deleteByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);
}
