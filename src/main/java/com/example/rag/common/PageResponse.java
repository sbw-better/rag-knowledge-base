package com.example.rag.common;

import java.util.List;

/**
 * 后端统一分页响应结构。
 *
 * <p>page 从 1 开始，pageSize 是本次请求的每页数量，total 是符合条件的总记录数。
 * 前端列表页统一读取 items 渲染，并根据 total / totalPages 控制分页按钮。</p>
 */
public record PageResponse<T>(
        List<T> items,
        int page,
        int pageSize,
        long total,
        int totalPages) {
    public static <T> PageResponse<T> of(List<T> items, int page, int pageSize, long total) {
        int totalPages = pageSize <= 0 ? 1 : Math.max(1, (int) Math.ceil((double) total / pageSize));
        int safePage = Math.min(Math.max(page, 1), totalPages);
        return new PageResponse<>(items, safePage, pageSize, total, totalPages);
    }
}
