package com.example.rag;

import com.example.rag.common.PageRequestParams;
import com.example.rag.common.PageResponse;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class PaginationTest {
    @Test
    void pageRequestParamsClampInvalidValuesAndTrimKeyword() {
        PageRequestParams params = PageRequestParams.of(-1, 200, "  客服  ");

        assertThat(params.page()).isEqualTo(1);
        assertThat(params.pageSize()).isEqualTo(100);
        assertThat(params.keyword()).isEqualTo("客服");
        assertThat(params.offset()).isEqualTo(0);
        assertThat(params.hasKeyword()).isTrue();
    }

    @Test
    void pageResponseCalculatesTotalPagesAndClampsCurrentPage() {
        PageResponse<String> response = PageResponse.of(List.of("a", "b"), 99, 20, 41);

        assertThat(response.total()).isEqualTo(41);
        assertThat(response.totalPages()).isEqualTo(3);
        assertThat(response.page()).isEqualTo(3);
        assertThat(response.items()).containsExactly("a", "b");
    }
}
