package com.example.rag.auth;

import com.example.rag.config.AppProperties;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Date;
import java.util.List;

@Component
public class JwtService {
    public JwtService(AppProperties properties) {
        this.properties = properties;
    }

    private final AppProperties properties;

    public String createToken(UserAccount user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(properties.security().jwtExpirationMinutes() * 60);
        List<String> roles = user.getRoles().stream().map(Role::getName).toList();
        return Jwts.builder()
                .subject(user.getId().toString())
                .claim("tenantId", user.getTenantId().toString())
                .claim("email", user.getEmail())
                .claim("roles", roles)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiresAt))
                .signWith(key())
                .compact();
    }

    public Long parseUserId(String token) {
        Claims claims = Jwts.parser().verifyWith(key()).build().parseSignedClaims(token).getPayload();
        return Long.valueOf(claims.getSubject());
    }

    private SecretKey key() {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(properties.security().jwtSecret().getBytes(StandardCharsets.UTF_8));
            return Keys.hmacShaKeyFor(bytes);
        } catch (Exception ex) {
            throw new IllegalStateException("Cannot create JWT key", ex);
        }
    }
}
