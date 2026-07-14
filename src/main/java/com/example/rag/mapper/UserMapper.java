package com.example.rag.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface UserMapper extends BaseMapper<UserAccount> {
    @Select("select * from users where tenant_id = #{tenantId} and lower(email) = lower(#{email}) limit 1")
    UserAccount selectByTenantIdAndEmailIgnoreCase(@Param("tenantId") Long tenantId, @Param("email") String email);

    @Select("select * from users where lower(email) = lower(#{email}) limit 1")
    UserAccount selectByEmailIgnoreCase(String email);

    @Select("select * from users where tenant_id = #{tenantId} order by created_at desc")
    List<UserAccount> selectByTenantId(Long tenantId);

    @Select("select r.* from roles r join user_roles ur on ur.role_id = r.id where ur.user_id = #{userId}")
    List<Role> selectRolesByUserId(Long userId);

    @Insert("insert into user_roles(user_id, role_id) values(#{userId}, #{roleId})")
    void insertUserRole(@Param("userId") Long userId, @Param("roleId") Long roleId);

    @Delete("delete from user_roles where user_id = #{userId}")
    void deleteUserRoles(Long userId);
}
