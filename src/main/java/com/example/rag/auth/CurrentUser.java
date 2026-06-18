package com.example.rag.auth;

import com.example.rag.common.ForbiddenException;
import com.example.rag.domain.UserAccount;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class CurrentUser {
    private CurrentUser() {
    }

    public static UserAccount required() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserAccount user)) {
            throw new ForbiddenException("Authentication required");
        }
        return user;
    }
}
