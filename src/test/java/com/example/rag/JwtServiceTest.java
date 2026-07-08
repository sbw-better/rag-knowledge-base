package com.example.rag;

import com.example.rag.auth.JwtService;
import com.example.rag.config.AppProperties;
import com.example.rag.domain.Role;
import com.example.rag.domain.UserAccount;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {
    @Test
    void createsAndParsesJwt() {
        AppProperties properties = new AppProperties(
                new AppProperties.Security("test-secret", 60),
                new AppProperties.Storage("http://localhost:9000", "a", "b", "bucket"),
                new AppProperties.Milvus("http://localhost:19530", "default", "rag_document_chunks", false),
                new AppProperties.Model("http://localhost", "", "chat", "embedding", 1536),
                new AppProperties.Ingestion(true, 1000, 3, 1),
                new AppProperties.Retrieval(0.65, 0.35));
        JwtService jwtService = new JwtService(properties);

        UserAccount user = new UserAccount();
        user.setId(1001L);
        user.setTenantId(2001L);
        user.setEmail("user@example.com");
        Role role = new Role();
        role.setName("USER");
        user.getRoles().add(role);

        String token = jwtService.createToken(user);

        assertThat(jwtService.parseUserId(token)).isEqualTo(user.getId());
    }
}
