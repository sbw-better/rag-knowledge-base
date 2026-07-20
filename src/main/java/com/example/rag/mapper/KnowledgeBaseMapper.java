package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.KnowledgeBase;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface KnowledgeBaseMapper extends BaseMapper<KnowledgeBase> {
    List<KnowledgeBase> selectVisibleByTenantId(@Param("tenantId") Long tenantId);

    KnowledgeBase selectByIdAndTenantIdNotDeleted(@Param("id") Long id, @Param("tenantId") Long tenantId);

    long countActiveByTenantId(@Param("tenantId") Long tenantId);
}
