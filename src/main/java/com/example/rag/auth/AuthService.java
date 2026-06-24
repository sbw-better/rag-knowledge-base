package com.example.rag.auth;

import com.example.rag.common.BadRequestException;
import com.example.rag.auth.dto.AuthResponse;
import com.example.rag.auth.dto.LoginRequest;
import com.example.rag.auth.dto.RegisterRequest;
import com.example.rag.auth.dto.UserResponse;
import com.example.rag.domain.Role;
import com.example.rag.domain.Tenant;
import com.example.rag.domain.UserAccount;
import com.example.rag.repository.RoleRepository;
import com.example.rag.repository.TenantRepository;
import com.example.rag.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 用户认证应用服务。
 *
 * <p>当前 MVP 使用一个默认租户承载所有用户，并通过 Spring Security 的
 * {@link PasswordEncoder} 保存密码哈希。第一个注册用户会被授予 ADMIN 角色，
 * 便于本地初始化系统；后续生产版本可替换为后台邀请或管理员创建用户流程。</p>
 */
@Service
public class AuthService {
    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    public AuthService(TenantRepository tenantRepository, UserRepository userRepository, RoleRepository roleRepository, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    private static final String DEFAULT_TENANT = "Default";

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        Tenant tenant = tenantRepository.findByName(DEFAULT_TENANT)
                .orElseGet(() -> tenantRepository.save(new Tenant(DEFAULT_TENANT)));
        userRepository.findByTenant_IdAndEmailIgnoreCase(tenant.getId(), normalizedEmail)
                .ifPresent(existing -> {
                    throw new BadRequestException("Email already registered");
                });

        boolean firstUser = userRepository.count() == 0;
        UserAccount user = new UserAccount();
        user.setTenant(tenant);
        user.setEmail(normalizedEmail);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.getRoles().add(requiredRole("USER"));
        if (firstUser) {
            user.getRoles().add(requiredRole("ADMIN"));
        }
        userRepository.save(user);
        log.info("User registered. userId={}, tenantId={}, email={}, firstUser={}",
                user.getId(), tenant.getId(), user.getEmail(), firstUser);
        return new AuthResponse(jwtService.createToken(user), toUserResponse(user));
    }

    /**
     * 校验邮箱和密码并签发 JWT。日志只记录用户 ID 和邮箱，不记录密码或 token。
     */
    public AuthResponse login(LoginRequest request) {
        UserAccount user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            log.warn("User login failed. email={}", request.email());
            throw new BadRequestException("Invalid email or password");
        }
        log.info("User login succeeded. userId={}, tenantId={}, email={}",
                user.getId(), user.getTenant().getId(), user.getEmail());
        return new AuthResponse(jwtService.createToken(user), toUserResponse(user));
    }

    public UserResponse me() {
        return toUserResponse(CurrentUser.required());
    }

    private Role requiredRole(String name) {
        return roleRepository.findByName(name).orElseThrow(() -> new IllegalStateException("Missing role " + name));
    }

    private static UserResponse toUserResponse(UserAccount user) {
        return new UserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRoles().stream().map(Role::getName).sorted().toList());
    }
}
