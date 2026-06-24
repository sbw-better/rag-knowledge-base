package com.example.rag.common;

/**
 * 404 Not Found 业务异常。
 *
 * <p>用于资源不存在，或为了避免暴露越权资源存在性而按“不存在”处理的场景。</p>
 */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
