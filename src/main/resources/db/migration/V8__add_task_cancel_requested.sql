alter table rag_tasks
    add column cancel_requested tinyint(1) not null default 0 after error_message;
