ALTER TABLE users DROP FOREIGN KEY fk_users_tenant;

ALTER TABLE user_roles DROP FOREIGN KEY fk_user_roles_user;
ALTER TABLE user_roles DROP FOREIGN KEY fk_user_roles_role;

ALTER TABLE knowledge_bases DROP FOREIGN KEY fk_kb_tenant;
ALTER TABLE knowledge_bases DROP FOREIGN KEY fk_kb_owner;

ALTER TABLE knowledge_base_members DROP FOREIGN KEY fk_kb_members_kb;
ALTER TABLE knowledge_base_members DROP FOREIGN KEY fk_kb_members_user;

ALTER TABLE documents DROP FOREIGN KEY fk_documents_tenant;
ALTER TABLE documents DROP FOREIGN KEY fk_documents_kb;
ALTER TABLE documents DROP FOREIGN KEY fk_documents_uploader;

ALTER TABLE rag_tasks DROP FOREIGN KEY fk_tasks_tenant;
ALTER TABLE rag_tasks DROP FOREIGN KEY fk_tasks_document;

ALTER TABLE document_chunks DROP FOREIGN KEY fk_chunks_tenant;
ALTER TABLE document_chunks DROP FOREIGN KEY fk_chunks_kb;
ALTER TABLE document_chunks DROP FOREIGN KEY fk_chunks_document;

ALTER TABLE conversations DROP FOREIGN KEY fk_conversations_tenant;
ALTER TABLE conversations DROP FOREIGN KEY fk_conversations_user;
ALTER TABLE conversations DROP FOREIGN KEY fk_conversations_kb;

ALTER TABLE messages DROP FOREIGN KEY fk_messages_conversation;

ALTER TABLE message_citations DROP FOREIGN KEY fk_citations_message;
ALTER TABLE message_citations DROP FOREIGN KEY fk_citations_document;
ALTER TABLE message_citations DROP FOREIGN KEY fk_citations_chunk;

ALTER TABLE audit_logs DROP FOREIGN KEY fk_audit_tenant;
ALTER TABLE audit_logs DROP FOREIGN KEY fk_audit_user;
