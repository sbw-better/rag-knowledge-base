package com.example.rag.mapper;

import com.example.rag.feedback.dto.KnowledgeIssueRecheckResponse;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface KnowledgeIssueRecheckMapper {
    @Insert("""
            INSERT INTO knowledge_issue_rechecks
            (id, tenant_id, issue_id, actor_id, outcome, summary, hit_count, created_at)
            VALUES (#{record.id}, #{tenantId}, #{record.issueId}, #{record.actorId},
                    #{record.outcome}, #{record.summary}, #{record.hitCount}, #{record.createdAt})
            """)
    int insert(@Param("tenantId") Long tenantId, @Param("record") KnowledgeIssueRecheckResponse record);

    @Select("""
            SELECT CAST(id AS CHAR) AS id, CAST(issue_id AS CHAR) AS issue_id,
                   CAST(actor_id AS CHAR) AS actor_id, outcome, summary, hit_count, created_at
            FROM knowledge_issue_rechecks
            WHERE tenant_id = #{tenantId} AND issue_id = #{issueId}
            ORDER BY created_at DESC, id DESC LIMIT 10
            """)
    List<KnowledgeIssueRecheckResponse> selectRecent(@Param("tenantId") Long tenantId, @Param("issueId") Long issueId);
}
