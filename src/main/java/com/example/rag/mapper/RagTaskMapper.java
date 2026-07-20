package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;
import java.util.List;

@Mapper
public interface RagTaskMapper extends BaseMapper<RagTask> {
    RagTask selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    RagTask selectLatestByDocumentId(@Param("documentId") Long documentId);

    List<RagTask> selectRunnable(@Param("status") TaskStatus status, @Param("limit") int limit);

    List<RagTask> selectTimedOutRunning(@Param("status") TaskStatus status,
                                        @Param("threshold") Instant threshold,
                                        @Param("limit") int limit);

    int deleteByDocumentId(@Param("documentId") Long documentId);
}
