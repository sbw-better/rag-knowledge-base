package com.example.rag.mapper;

import com.example.rag.domain.RagTask;

/**
 * 任务中心列表行。
 *
 * <p>在任务表基础上补充关联知识库和文档名称，避免前端逐条再查资源。</p>
 */
public class TaskListRow extends RagTask {
    private String knowledgeBaseName;
    private String documentFileName;

    public String getKnowledgeBaseName() {
        return knowledgeBaseName;
    }

    public void setKnowledgeBaseName(String knowledgeBaseName) {
        this.knowledgeBaseName = knowledgeBaseName;
    }

    public String getDocumentFileName() {
        return documentFileName;
    }

    public void setDocumentFileName(String documentFileName) {
        this.documentFileName = documentFileName;
    }
}
