package com.example.rag.parser;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class TextChunker {
    public List<String> split(String text, int chunkSize, int overlap) {
        String source = text == null ? "" : text.trim();
        if (source.isEmpty()) {
            return List.of();
        }
        int size = Math.max(chunkSize, 200);
        int safeOverlap = Math.min(Math.max(overlap, 0), size / 2);
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < source.length()) {
            int end = Math.min(start + size, source.length());
            if (end < source.length()) {
                int boundary = Math.max(source.lastIndexOf('\n', end), source.lastIndexOf('。', end));
                if (boundary > start + size / 2) {
                    end = boundary + 1;
                }
            }
            String chunk = source.substring(start, end).trim();
            if (!chunk.isBlank()) {
                chunks.add(chunk);
            }
            if (end >= source.length()) {
                break;
            }
            start = Math.max(end - safeOverlap, start + 1);
        }
        return chunks;
    }
}
