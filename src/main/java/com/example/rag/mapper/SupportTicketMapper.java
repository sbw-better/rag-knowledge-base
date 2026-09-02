package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.SupportTicket;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SupportTicketMapper extends BaseMapper<SupportTicket> {
    SupportTicket selectByIdAndTenantId(@Param("id") Long id, @Param("tenantId") Long tenantId);

    long countByTenantId(@Param("tenantId") Long tenantId,
                         @Param("knowledgeBaseId") Long knowledgeBaseId,
                         @Param("status") String status,
                         @Param("priority") String priority,
                         @Param("keyword") String keyword);

    List<SupportTicket> selectPageByTenantId(@Param("tenantId") Long tenantId,
                                             @Param("knowledgeBaseId") Long knowledgeBaseId,
                                             @Param("status") String status,
                                             @Param("priority") String priority,
                                             @Param("keyword") String keyword,
                                             @Param("limit") int limit,
                                             @Param("offset") int offset);
}
