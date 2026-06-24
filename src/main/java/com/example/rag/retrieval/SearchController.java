package com.example.rag.retrieval;

import com.example.rag.common.ApiResponse;
import com.example.rag.retrieval.dto.SearchRequest;
import com.example.rag.retrieval.dto.SearchResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/search")
public class SearchController {
    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    private final SearchService searchService;

    @PostMapping
    ApiResponse<SearchResponse> search(@Valid @RequestBody SearchRequest request) {
        return ApiResponse.ok(searchService.search(request));
    }
}
