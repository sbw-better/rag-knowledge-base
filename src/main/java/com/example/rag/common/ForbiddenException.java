package com.example.rag.common;

/**
 * 403 Forbidden 业务异常。
 *
 * <p>用于当前请求没有有效登录态，或登录用户没有访问目标资源的权限。</p>
 */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
