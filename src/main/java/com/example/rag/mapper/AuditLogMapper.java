package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.AuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface AuditLogMapper extends BaseMapper<AuditLog> {
    List<AuditLog> selectPage(@Param("allTenants") boolean allTenants,
                              @Param("tenantId") Long tenantId,
                              @Param("action") String action,
                              @Param("keyword") String keyword,
                              @Param("limit") int limit,
                              @Param("offset") int offset);

    long countPage(@Param("allTenants") boolean allTenants,
                   @Param("tenantId") Long tenantId,
                   @Param("action") String action,
                   @Param("keyword") String keyword);
}
