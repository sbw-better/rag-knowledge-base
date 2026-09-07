package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.SupportTicket;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.Instant;
import java.util.List;

@Mapper
public interface SupportTicketMapper extends BaseMapper<SupportTicket> {
    SupportTicket selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    long countByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                         @Param("knowledgeBaseId") Long knowledgeBaseId,
                         @Param("status") String status,
                         @Param("priority") String priority,
                         @Param("assigneeId") Long assigneeId,
                         @Param("overdueOnly") boolean overdueOnly,
                         @Param("keyword") String keyword);

    SupportTicketStatsRow selectStatsByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                @Param("startAt") Instant startAt,
                                                @Param("endAt") Instant endAt);

    SupportTicketEventStatsRow selectEventStatsByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                          @Param("startAt") Instant startAt,
                                                          @Param("endAt") Instant endAt);

    List<SupportTicketStatsBucketRow> selectCategoryBucketsByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                                      @Param("startAt") Instant startAt,
                                                                      @Param("endAt") Instant endAt,
                                                                      @Param("limit") int limit);

    List<SupportTicketStatsBucketRow> selectChannelBucketsByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                                     @Param("startAt") Instant startAt,
                                                                     @Param("endAt") Instant endAt,
                                                                     @Param("limit") int limit);

    List<SupportTicketStatsBucketRow> selectPriorityBucketsByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                                      @Param("startAt") Instant startAt,
                                                                      @Param("endAt") Instant endAt);

    List<SupportTicketTrendRow> selectTrendByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                      @Param("startAt") Instant startAt,
                                                      @Param("endAt") Instant endAt);

    List<SupportTicketAgentStatsRow> selectAgentStatsByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                                                @Param("startAt") Instant startAt,
                                                                @Param("endAt") Instant endAt,
                                                                @Param("limit") int limit);

    List<SupportTicket> selectPageByTenantId(@Param("tenantId") Long tenantId,
            @Param("knowledgeBaseIds") List<Long> knowledgeBaseIds,
                                             @Param("knowledgeBaseId") Long knowledgeBaseId,
                                             @Param("status") String status,
                                             @Param("priority") String priority,
                                             @Param("assigneeId") Long assigneeId,
                                             @Param("overdueOnly") boolean overdueOnly,
                                             @Param("keyword") String keyword,
                                             @Param("limit") int limit,
                                             @Param("offset") int offset);
}
