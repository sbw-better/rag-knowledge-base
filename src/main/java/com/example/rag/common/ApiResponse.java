package com.example.rag.common;

/**
 * 后端统一响应结构。
 *
 * <p>所有 Controller 正常返回 {@code success=true,data=...}，业务失败返回
 * {@code success=false,error=...}。前端 {@code api.ts} 的 axios 响应拦截器会识别这个结构，
 * 自动解包 data 或把 error 转成统一的 ApiError。</p>
 */
public record ApiResponse<T>(boolean success, T data, String error) {
    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> fail(String error) {
        return new ApiResponse<>(false, null, error);
    }
}
