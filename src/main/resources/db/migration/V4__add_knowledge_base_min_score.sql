ALTER TABLE knowledge_bases
    ADD COLUMN min_score DOUBLE NOT NULL DEFAULT 0 AFTER top_k;
