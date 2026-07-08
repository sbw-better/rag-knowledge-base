package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.KnowledgeBase;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface KnowledgeBaseMapper extends BaseMapper<KnowledgeBase> {
    @Select("select * from knowledge_bases where tenant_id = #{tenantId} and deleted = 0 order by created_at desc")
    List<KnowledgeBase> selectVisibleByTenantId(Long tenantId);

    @Select("select * from knowledge_bases where id = #{id} and tenant_id = #{tenantId} and deleted = 0 limit 1")
    KnowledgeBase selectByIdAndTenantIdNotDeleted(@Param("id") Long id, @Param("tenantId") Long tenantId);
}
