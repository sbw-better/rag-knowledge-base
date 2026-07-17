package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.DocumentEntity;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface DocumentMapper extends BaseMapper<DocumentEntity> {
    @Select("select * from documents where id = #{id} and tenant_id = #{tenantId} limit 1")
    DocumentEntity selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    @Select("select * from documents where knowledge_base_id = #{knowledgeBaseId} and tenant_id = #{tenantId} order by created_at desc")
    List<DocumentEntity> selectByKnowledgeBaseIdAndTenantId(@Param("knowledgeBaseId") Long knowledgeBaseId, @Param("tenantId") Long tenantId);

    @Delete("delete from documents where id = #{id} and tenant_id = #{tenantId}")
    int deleteByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);
}
