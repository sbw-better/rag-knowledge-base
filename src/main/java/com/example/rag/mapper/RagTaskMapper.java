package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RagTaskMapper extends BaseMapper<RagTask> {
    @Select("select * from rag_tasks where id = #{id} and tenant_id = #{tenantId} limit 1")
    RagTask selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    @Select("select * from rag_tasks where document_id = #{documentId} order by created_at desc limit 1")
    RagTask selectLatestByDocumentId(Long documentId);

    @Select("select * from rag_tasks where status = #{status} order by created_at asc limit #{limit}")
    List<RagTask> selectRunnable(@Param("status") TaskStatus status, @Param("limit") int limit);
}
