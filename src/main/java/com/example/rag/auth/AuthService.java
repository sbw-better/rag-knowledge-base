package com.example.rag.auth;

import com.example.rag.common.BadRequestException;
import com.example.rag.domain.Role;
import com.example.rag.domain.Tenant;
import com.example.rag.domain.UserAccount;
import com.example.rag.dto.ApiDtos;
import com.example.rag.repository.RoleRepository;
import com.example.rag.repository.TenantRepository;
import com.example.rag.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
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
    public ApiDtos.AuthResponse register(ApiDtos.RegisterRequest request) {
        Tenant tenant = tenantRepository.findByName(DEFAULT_TENANT)
                .orElseGet(() -> tenantRepository.save(new Tenant(DEFAULT_TENANT)));
        userRepository.findByTenant_IdAndEmailIgnoreCase(tenant.getId(), request.email())
                .ifPresent(existing -> {
                    throw new BadRequestException("Email already registered");
                });

        boolean firstUser = userRepository.count() == 0;
        UserAccount user = new UserAccount();
        user.setTenant(tenant);
        user.setEmail(request.email().trim().toLowerCase());
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.getRoles().add(requiredRole("USER"));
        if (firstUser) {
            user.getRoles().add(requiredRole("ADMIN"));
        }
        userRepository.save(user);
        return new ApiDtos.AuthResponse(jwtService.createToken(user), toUserResponse(user));
    }

    public ApiDtos.AuthResponse login(ApiDtos.LoginRequest request) {
        UserAccount user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new BadRequestException("Invalid email or password"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BadRequestException("Invalid email or password");
        }
        return new ApiDtos.AuthResponse(jwtService.createToken(user), toUserResponse(user));
    }

    public ApiDtos.UserResponse me() {
        return toUserResponse(CurrentUser.required());
    }

    private Role requiredRole(String name) {
        return roleRepository.findByName(name).orElseThrow(() -> new IllegalStateException("Missing role " + name));
    }

    private static ApiDtos.UserResponse toUserResponse(UserAccount user) {
        return new ApiDtos.UserResponse(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getRoles().stream().map(Role::getName).sorted().toList());
    }
}
