package com.example.rag.common;

/**
 * 外部字符串 ID 与内部 Long 雪花 ID 的转换工具。
 *
 * <p>前端必须用 string 承载雪花 ID，避免 JavaScript number 精度丢失；后端业务内部统一使用 Long。</p>
 */
public final class Ids {
    private Ids() {
    }

    public static Long parse(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required");
        }
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException ex) {
            throw new BadRequestException(fieldName + " must be a numeric snowflake id");
        }
    }
}
