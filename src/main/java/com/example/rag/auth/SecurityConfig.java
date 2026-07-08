package com.example.rag.auth;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.config.annotation.web.configurers.AuthorizeHttpRequestsConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.util.Arrays;

/**
 * Spring Security 安全配置。
 *
 * <p>这个类在项目启动时由 Spring 扫描并加载，用来创建 {@link SecurityFilterChain}。
 * 它本身不是每次请求执行的“拦截器”，而是告诉 Spring Security：后续所有 HTTP 请求
 * 应该经过哪些过滤器、哪些接口可以匿名访问、哪些接口必须登录。</p>
 *
 * <p>本项目采用前后端分离 + JWT 的无状态认证方式，因此关闭传统 session 登录，
 * 并把 {@link JwtAuthenticationFilter} 注册到 Spring Security 过滤器链中。请求真正进入后端时，
 * JwtAuthenticationFilter 会解析 Authorization 请求头并设置当前用户上下文。</p>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {
    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, Environment environment) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.environment = environment;
    }

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final Environment environment;

    /**
     * 创建安全过滤器链。
     *
     * <p>该方法只在应用启动时执行一次，返回的 {@link SecurityFilterChain} 会被 Spring Security
     * 保存起来。之后每个请求进入后端时，Spring Security 都会使用这条过滤器链处理请求。</p>
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        boolean prod = Arrays.asList(environment.getActiveProfiles()).contains("prod");
        return http
                // 前后端分离项目使用 Bearer Token，不依赖浏览器 Cookie 提交表单，因此关闭 CSRF。
                .csrf(csrf -> csrf.disable())
                // JWT 自身携带登录态，后端不创建 HttpSession，便于水平扩容。
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> configureAuthorization(auth, prod))
                // 把自定义 JWT 过滤器放到 Spring Security 用户名密码过滤器之前。
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * 配置 URL 访问规则。
     *
     * <p>认证相关接口和健康检查允许匿名访问；Swagger 只在非生产环境开放；
     * 其他业务接口必须先通过 JWT 认证。业务级权限，例如知识库 owner/admin/member，
     * 不在这里判断，而是在对应 Service 中基于当前用户进一步校验。</p>
     */
    private void configureAuthorization(
            AuthorizeHttpRequestsConfigurer<HttpSecurity>.AuthorizationManagerRequestMatcherRegistry auth,
            boolean prod) {
        auth.requestMatchers("/api/auth/register", "/api/auth/login", "/actuator/health").permitAll();
        if (!prod) {
            auth.requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**", "/actuator/info").permitAll();
        }
        auth.anyRequest().authenticated();
    }

    /**
     * 密码哈希器。
     *
     * <p>注册时使用 BCrypt 保存密码哈希，登录时用同一个 PasswordEncoder 校验密码。
     * 数据库中不会保存明文密码。</p>
     */
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * 占位 UserDetailsService。
     *
     * <p>Spring Security 的默认表单登录体系会依赖 UserDetailsService，但本项目的认证入口
     * 是自定义 JWT Filter，不走默认用户名密码过滤器加载用户。这里显式抛错，避免误用。</p>
     */
    @Bean
    UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Use JWT authentication");
        };
    }
}
