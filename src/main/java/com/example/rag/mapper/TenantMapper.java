package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Tenant;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TenantMapper extends BaseMapper<Tenant> {
    @Select("select * from tenants where name = #{name} limit 1")
    Tenant selectByName(String name);

    @Select("select * from tenants where lower(name) = lower(#{name}) limit 1")
    Tenant selectByNameIgnoreCase(String name);

    @Select("select * from tenants order by created_at desc")
    List<Tenant> selectAllOrderByCreatedAtDesc();
}
