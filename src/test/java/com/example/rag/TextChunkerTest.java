package com.example.rag;

import com.example.rag.parser.TextChunker;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TextChunkerTest {
    @Test
    void splitsTextWithOverlap() {
        TextChunker chunker = new TextChunker();

        List<String> chunks = chunker.split("第一段内容。\n第二段内容。\n第三段内容。", 10, 3);

        assertThat(chunks).isNotEmpty();
        assertThat(chunks.get(0)).contains("第一段");
    }

    @Test
    void returnsEmptyListForBlankText() {
        assertThat(new TextChunker().split("   ", 800, 120)).isEmpty();
    }
}
