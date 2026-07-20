package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface UserMapper extends BaseMapper<UserAccount> {
    UserAccount selectByTenantIdAndEmailIgnoreCase(@Param("tenantId") Long tenantId, @Param("email") String email);

    UserAccount selectByEmailIgnoreCase(@Param("email") String email);

    List<UserAccount> selectByTenantId(@Param("tenantId") Long tenantId);

    List<UserAccount> selectPageByTenantId(@Param("tenantId") Long tenantId,
                                           @Param("keyword") String keyword,
                                           @Param("limit") int limit,
                                           @Param("offset") int offset);

    long countByTenantId(@Param("tenantId") Long tenantId);

    long countByTenantIdAndKeyword(@Param("tenantId") Long tenantId, @Param("keyword") String keyword);

    List<Role> selectRolesByUserId(@Param("userId") Long userId);

    void insertUserRole(@Param("userId") Long userId, @Param("roleId") Long roleId);

    void deleteUserRoles(@Param("userId") Long userId);
}
