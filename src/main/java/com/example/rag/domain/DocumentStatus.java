package com.example.rag.domain;

/**
 * 文档处理状态。
 *
 * <p>UPLOADED 表示原始文件已保存；PROCESSING 表示后台正在解析和入库；
 * INDEXED 表示切片和向量已写入，可被检索；FAILED 表示入库失败。</p>
 */
public enum DocumentStatus {
    UPLOADED, PROCESSING, INDEXED, FAILED
}
