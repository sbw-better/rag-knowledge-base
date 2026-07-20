package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Tenant;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TenantMapper extends BaseMapper<Tenant> {
    Tenant selectByName(@Param("name") String name);

    Tenant selectByNameIgnoreCase(@Param("name") String name);

    List<Tenant> selectAllOrderByCreatedAtDesc();
}
