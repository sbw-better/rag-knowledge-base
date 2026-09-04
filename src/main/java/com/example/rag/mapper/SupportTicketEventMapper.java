package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.SupportTicketEvent;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SupportTicketEventMapper extends BaseMapper<SupportTicketEvent> {
    List<SupportTicketEvent> selectByTicketId(@Param("tenantId") Long tenantId, @Param("ticketId") Long ticketId);
}
