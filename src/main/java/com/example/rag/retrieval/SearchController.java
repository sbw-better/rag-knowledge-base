package com.example.rag.retrieval;

import com.example.rag.common.ApiResponse;
import com.example.rag.retrieval.dto.SearchRequest;
import com.example.rag.retrieval.dto.SearchResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 检索测试接口入口。
 *
 * <p>该接口面向知识库维护者，用来验证文档切片、向量入库、关键词检索和混合检索效果。
 * 线上面向普通用户的问答链路通常会调用 ChatController，而不是直接暴露检索测试页面。</p>
 */
@RestController
@RequestMapping("/api/search")
public class SearchController {
    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    private final SearchService searchService;

    /**
     * 执行一次检索。
     *
     * <p>支持 VECTOR、KEYWORD、HYBRID 三种模式。请求可以临时覆盖 topK，用于调试召回数量；
     * 不传 topK 时使用知识库设置中的默认值。</p>
     */
    @PostMapping
    ApiResponse<SearchResponse> search(@Valid @RequestBody SearchRequest request) {
        return ApiResponse.ok(searchService.search(request));
    }
}
