package com.example.rag.parser;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 文本切片器。
 *
 * <p>第一版采用按字符长度切分，并尽量在换行或中文句号处断开，减少把一句话硬切开的概率。
 * overlap 用于保留上下文连续性，避免答案所需信息正好落在两个切片边界。</p>
 */
@Component
public class TextChunker {
    /**
     * 将清洗后的文本拆成多个 chunk。
     *
     * @param text 原始文本
     * @param chunkSize 目标切片大小，最小会保护到 200
     * @param overlap 相邻切片重叠字符数，最大不超过 chunkSize 的一半
     */
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
