CREATE TABLE knowledge_issue_rechecks (
  id BIGINT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  issue_id BIGINT NOT NULL,
  actor_id BIGINT NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  summary VARCHAR(2000) NOT NULL,
  hit_count INT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  KEY idx_issue_rechecks (tenant_id, issue_id, created_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
