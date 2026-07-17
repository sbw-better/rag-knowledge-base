ALTER TABLE message_citations
    DROP FOREIGN KEY fk_citations_document;

ALTER TABLE message_citations
    DROP FOREIGN KEY fk_citations_chunk;

ALTER TABLE message_citations
    ADD CONSTRAINT fk_citations_document
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE;

ALTER TABLE message_citations
    ADD CONSTRAINT fk_citations_chunk
        FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE;
