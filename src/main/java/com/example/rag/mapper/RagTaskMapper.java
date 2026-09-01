package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.RagTask;
import com.example.rag.domain.TaskStatus;
import com.example.rag.domain.TaskType;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;
import java.util.List;

@Mapper
public interface RagTaskMapper extends BaseMapper<RagTask> {
    RagTask selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    RagTask selectLatestByDocumentId(@Param("documentId") Long documentId);

    long countPageByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                    @Param("knowledgeBaseId") Long knowledgeBaseId,
                                    @Param("type") TaskType type,
                                    @Param("status") TaskStatus status,
                                    @Param("keyword") String keyword);

    List<TaskListRow> selectPageByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                                  @Param("knowledgeBaseId") Long knowledgeBaseId,
                                                  @Param("type") TaskType type,
                                                  @Param("status") TaskStatus status,
                                                  @Param("keyword") String keyword,
                                                  @Param("limit") int limit,
                                                  @Param("offset") int offset);

    TaskStatsRow selectStatsByKnowledgeBaseId(@Param("tenantId") Long tenantId,
                                              @Param("knowledgeBaseId") Long knowledgeBaseId);

    List<RagTask> selectRunnable(@Param("type") TaskType type, @Param("status") TaskStatus status, @Param("limit") int limit);

    List<RagTask> selectTimedOutRunning(@Param("type") TaskType type,
                                        @Param("status") TaskStatus status,
                                        @Param("threshold") Instant threshold,
                                        @Param("limit") int limit);

    int deleteByDocumentId(@Param("documentId") Long documentId);
}
