package com.example.rag.domain;

/**
 * 异步任务状态。
 *
 * <p>PENDING 等待 worker 执行；RUNNING 正在处理；SUCCEEDED 成功完成；
 * FAILED 达到最大重试次数后失败；CANCELLED 为后续取消任务能力预留。</p>
 */
public enum TaskStatus {
    PENDING, RUNNING, SUCCEEDED, FAILED, CANCELLED
}
