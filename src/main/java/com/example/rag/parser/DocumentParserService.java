package com.example.rag.parser;

import com.example.rag.common.BadRequestException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Component;
import org.xml.sax.ContentHandler;

import java.io.InputStream;
import java.text.Normalizer;

/**
 * 文档解析和文本清洗服务。
 *
 * <p>当前使用 Apache Tika 自动识别 PDF、DOCX、TXT、Markdown、HTML 等格式。
 * 解析完成后会做基础归一化和空白清洗，保证后续切片和 Embedding 输入更稳定。</p>
 */
@Component
public class DocumentParserService {
    /**
     * 从输入流抽取正文文本。异常会转为业务异常，交给入库任务记录失败原因。
     */
    public String parse(InputStream inputStream) {
        try {
            AutoDetectParser parser = new AutoDetectParser();
            ContentHandler handler = new BodyContentHandler(-1);
            Metadata metadata = new Metadata();
            parser.parse(inputStream, handler, metadata, new ParseContext());
            return clean(handler.toString());
        } catch (Exception ex) {
            throw new BadRequestException("Failed to parse document: " + ex.getMessage());
        }
    }

    /**
     * 执行轻量文本清洗：Unicode 归一化、空白字符压缩、连续空行压缩。
     */
    public String clean(String text) {
        String normalized = Normalizer.normalize(text == null ? "" : text, Normalizer.Form.NFKC);
        return normalized.replace('\u00A0', ' ')
                .replaceAll("[\\t\\x0B\\f\\r]+", " ")
                .replaceAll("(?m)^\\s+$", "")
                .replaceAll("\\n{3,}", "\n\n")
                .trim();
    }
}
