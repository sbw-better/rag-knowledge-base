package com.example.rag.common;

/**
 * 400 Bad Request 业务异常。
 *
 * <p>用于请求参数不合法或当前业务状态不允许继续处理的场景，例如文件类型不支持、
 * chunkOverlap 大于 chunkSize、模型调用参数错误等。</p>
 */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
