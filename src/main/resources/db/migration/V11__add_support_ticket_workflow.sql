ALTER TABLE support_tickets
  ADD COLUMN assignee_id BIGINT NULL AFTER created_by,
  ADD COLUMN due_at DATETIME(6) NULL AFTER purchased_at,
  ADD KEY idx_support_tickets_assignee_status_due (tenant_id, assignee_id, status, due_at),
  ADD KEY idx_support_tickets_due (tenant_id, due_at),
  ADD CONSTRAINT fk_support_tickets_assignee FOREIGN KEY (assignee_id) REFERENCES users(id);

CREATE TABLE support_ticket_events (
  id BIGINT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  ticket_id BIGINT NOT NULL,
  actor_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NULL,
  from_assignee_id BIGINT NULL,
  to_assignee_id BIGINT NULL,
  note TEXT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_ticket_events_ticket_created (ticket_id, created_at),
  KEY idx_ticket_events_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_ticket_events_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ticket_events_ticket FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ticket_events_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT fk_ticket_events_from_assignee FOREIGN KEY (from_assignee_id) REFERENCES users(id),
  CONSTRAINT fk_ticket_events_to_assignee FOREIGN KEY (to_assignee_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
