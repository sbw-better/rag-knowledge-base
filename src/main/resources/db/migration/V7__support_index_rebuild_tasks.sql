ALTER TABLE rag_tasks
    ADD COLUMN knowledge_base_id BIGINT NULL AFTER document_id,
    MODIFY COLUMN document_id BIGINT NULL,
    ADD KEY idx_tasks_kb_created (knowledge_base_id, created_at);
