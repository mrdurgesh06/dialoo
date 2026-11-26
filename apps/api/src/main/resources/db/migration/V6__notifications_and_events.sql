-- V6: Event-driven notifications (SRS 29): every booking event reaches customer, provider AND admins.

ALTER TABLE notifications
  ADD COLUMN entity_type VARCHAR(30) NULL,
  ADD COLUMN entity_id BIGINT NULL,
  ADD COLUMN audience VARCHAR(20) NOT NULL DEFAULT 'USER',   -- USER / PROVIDER / ADMIN / BROADCAST
  ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT 'NORMAL', -- LOW / NORMAL / HIGH
  ADD COLUMN channel VARCHAR(10) NOT NULL DEFAULT 'IN_APP',
  ADD COLUMN data JSON NULL,
  ADD INDEX idx_notif_entity (entity_type, entity_id),
  ADD INDEX idx_notif_user_created (user_id, created_at);

CREATE TABLE notification_preferences (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  category VARCHAR(30) NOT NULL,            -- BOOKING / OFFERS / SYSTEM
  in_app BOOLEAN NOT NULL DEFAULT TRUE,
  push BOOLEAN NOT NULL DEFAULT TRUE,
  sms BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_np_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_np (user_id, category)
);

CREATE TABLE device_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token VARCHAR(255) NOT NULL,
  platform VARCHAR(10) NOT NULL DEFAULT 'WEB',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_dt_user FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY uq_device_token (token)
);

-- Transactional outbox / domain event log: lets a queue worker or push gateway be added later without code changes.
CREATE TABLE domain_events (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  event_type VARCHAR(50) NOT NULL,
  aggregate_type VARCHAR(30) NOT NULL,
  aggregate_id BIGINT NOT NULL,
  payload JSON NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'NEW',
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  processed_at DATETIME NULL,
  INDEX idx_event_status (status, created_at),
  INDEX idx_event_agg (aggregate_type, aggregate_id)
);

CREATE TABLE notification_broadcasts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NOT NULL,
  audience VARCHAR(20) NOT NULL,            -- ALL / CUSTOMERS / PROVIDERS / ADMINS
  recipients INT NOT NULL DEFAULT 0,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_nb_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
