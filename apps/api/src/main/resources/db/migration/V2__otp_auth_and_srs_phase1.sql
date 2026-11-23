-- V2: OTP passwordless auth, refresh tokens, audit, plans, notifications, booking history (SRS v1.0 Phase 1)
-- Additive and backward compatible: existing password login keeps working.

ALTER TABLE users MODIFY password_hash VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN public_id CHAR(26) NULL UNIQUE;
ALTER TABLE users ADD COLUMN preferred_language VARCHAR(10) NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL;
UPDATE users SET public_id = UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 26)) WHERE public_id IS NULL;

CREATE TABLE otp_verifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  mobile_number VARCHAR(15) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  purpose VARCHAR(20) NOT NULL DEFAULT 'LOGIN',
  expires_at DATETIME NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  request_ip VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  INDEX idx_otp_lookup (mobile_number, purpose, expires_at),
  INDEX idx_otp_created (mobile_number, created_at)
);

CREATE TABLE refresh_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  device_info VARCHAR(255) NULL,
  issued_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_refresh_user (user_id, revoked_at)
);

CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  actor_user_id BIGINT NULL,
  action VARCHAR(60) NOT NULL,
  entity_type VARCHAR(40) NULL,
  entity_id VARCHAR(40) NULL,
  detail VARCHAR(500) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity_type, entity_id, created_at),
  INDEX idx_audit_actor (actor_user_id, created_at)
);

CREATE TABLE booking_status_history (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  from_status VARCHAR(24) NULL,
  to_status VARCHAR(24) NOT NULL,
  changed_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_bsh_booking FOREIGN KEY (booking_id) REFERENCES bookings(id),
  CONSTRAINT fk_bsh_user FOREIGN KEY (changed_by) REFERENCES users(id),
  INDEX idx_bsh_booking (booking_id, created_at)
);

CREATE TABLE notifications (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body VARCHAR(500) NULL,
  read_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_notif_feed (user_id, read_at, created_at)
);

CREATE TABLE subscription_plans (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  billing_period VARCHAR(10) NOT NULL DEFAULT 'MONTHLY',
  features VARCHAR(1000) NULL,
  request_limit INT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
);

CREATE TABLE provider_subscriptions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  provider_id BIGINT NOT NULL,
  plan_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'TRIAL',
  current_period_start DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  current_period_end DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_psub_provider FOREIGN KEY (provider_id) REFERENCES providers(id),
  CONSTRAINT fk_psub_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
  INDEX idx_psub_status (status, current_period_end)
);

CREATE TABLE feature_flags (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  flag_key VARCHAR(60) NOT NULL UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
);

-- Illustrative prices from SRS section 46; admin-configurable data, never hardcoded in code.
INSERT INTO subscription_plans(name,price,billing_period,features,request_limit) VALUES
('Free',0,'MONTHLY','Basic profile, limited visibility',5),
('Professional',99,'MONTHLY','Improved search ranking, more requests',50),
('Pro',199,'MONTHLY','Priority placement, analytics',NULL),
('Business',499,'MONTHLY','Multi-employee business profile features',NULL);

INSERT INTO feature_flags(flag_key,is_enabled,description) VALUES
('OTP_LOGIN_ENABLED',TRUE,'Passwordless mobile OTP login'),
('EMERGENCY_ENABLED',TRUE,'Dialoo Emergency (record-only until operations exist)'),
('AGRI_ENABLED',FALSE,'Dialoo Agri equipment access (Phase 2)'),
('RENTALS_ENABLED',TRUE,'Dialoo Rentals'),
('PROJECTS_ENABLED',TRUE,'Dialoo Projects');
