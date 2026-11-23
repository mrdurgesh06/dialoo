-- V10: Admin staff management + forgot-password support (SRS 21, 36, 37). Additive only.

-- A staff account created by a SUPER_ADMIN gets a one-time temporary password and must choose its own at first sign-in.
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- Trail of password-reset requests (who asked, from where, did it finish). The OTP itself is never stored here.
CREATE TABLE admin_password_resets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  identifier VARCHAR(190) NOT NULL,
  ip_address VARCHAR(45) NULL,
  status VARCHAR(12) NOT NULL,                 -- REQUESTED / COMPLETED / FAILED
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  CONSTRAINT fk_apr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_apr_user (user_id, created_at),
  INDEX idx_apr_ip (ip_address, created_at)
);

-- Who may manage locations (cities / localities / streets) from the admin panel
INSERT INTO permissions(code,description) VALUES ('LOCATION_MANAGE','Manage cities, localities and streets');
INSERT INTO role_permissions(role_code,permission_code) VALUES ('ADMIN','LOCATION_MANAGE'),('SUPER_ADMIN','LOCATION_MANAGE');
