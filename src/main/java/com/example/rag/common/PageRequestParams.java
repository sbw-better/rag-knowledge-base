package com.example.rag.common;

/**
 * 列表接口的分页参数清洗结果。
 *
 * <p>Controller 接收到的 page/pageSize/keyword 来自 URL 查询参数，不应直接进入 SQL。
 * 该类型负责把页码限制到合理范围，并生成 MySQL limit/offset。</p>
 */
public record PageRequestParams(int page, int pageSize, String keyword) {
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    public static PageRequestParams of(Integer page, Integer pageSize, String keyword) {
        int safePage = page == null || page < 1 ? DEFAULT_PAGE : page;
        int safePageSize = pageSize == null || pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        String safeKeyword = keyword == null ? "" : keyword.trim();
        return new PageRequestParams(safePage, safePageSize, safeKeyword);
    }

    public int offset() {
        return (page - 1) * pageSize;
    }

    public boolean hasKeyword() {
        return !keyword.isBlank();
    }
}
