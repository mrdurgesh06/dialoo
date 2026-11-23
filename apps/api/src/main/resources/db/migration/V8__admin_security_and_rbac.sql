-- V8: Admin security hardening + RBAC (SRS 21, 36, 37).

ALTER TABLE users
  ADD COLUMN failed_login_count INT NOT NULL DEFAULT 0,
  ADD COLUMN locked_until DATETIME NULL,
  ADD COLUMN password_changed_at DATETIME NULL,
  ADD COLUMN token_version INT NOT NULL DEFAULT 0,       -- bump to invalidate all access tokens instantly
  ADD COLUMN last_login_ip VARCHAR(45) NULL,
  ADD COLUMN avatar_url VARCHAR(255) NULL,
  ADD COLUMN updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  ADD INDEX idx_user_role (role, enabled),
  ADD INDEX idx_user_created (created_at);

CREATE TABLE roles (
  code VARCHAR(24) PRIMARY KEY,
  description VARCHAR(160) NOT NULL,
  is_staff BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE permissions (
  code VARCHAR(60) PRIMARY KEY,
  description VARCHAR(160) NOT NULL
);
CREATE TABLE role_permissions (
  role_code VARCHAR(24) NOT NULL,
  permission_code VARCHAR(60) NOT NULL,
  PRIMARY KEY (role_code, permission_code),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_code) REFERENCES roles(code),
  CONSTRAINT fk_rp_perm FOREIGN KEY (permission_code) REFERENCES permissions(code)
);

INSERT INTO roles(code,description,is_staff) VALUES
('CUSTOMER','Requests services and reviews providers',FALSE),
('PROVIDER','Offers services',FALSE),
('BUSINESS','Multi-employee service business',FALSE),
('SUPPORT','Support staff: read operations and handle bookings',TRUE),
('ADMIN','Manages catalog, providers, users, offers',TRUE),
('SUPER_ADMIN','Full control including staff and settings',TRUE);

INSERT INTO permissions(code,description) VALUES
('DASHBOARD_VIEW','View dashboard and analytics'),
('BOOKING_VIEW','View all bookings'),
('BOOKING_MANAGE','Force-update or cancel bookings'),
('PROVIDER_VIEW','View providers'),
('PROVIDER_APPROVE','Approve, reject, suspend providers'),
('USER_VIEW','View users'),
('USER_MANAGE','Enable or disable users'),
('CATALOG_MANAGE','Manage categories, services, banners'),
('COUPON_MANAGE','Manage coupons'),
('NOTIFY_BROADCAST','Send broadcast notifications'),
('AUDIT_VIEW','View audit logs'),
('SETTINGS_MANAGE','Change feature flags and system settings'),
('STAFF_MANAGE','Create or change staff roles');

INSERT INTO role_permissions(role_code,permission_code) VALUES
('SUPPORT','DASHBOARD_VIEW'),('SUPPORT','BOOKING_VIEW'),('SUPPORT','BOOKING_MANAGE'),('SUPPORT','PROVIDER_VIEW'),('SUPPORT','USER_VIEW'),
('ADMIN','DASHBOARD_VIEW'),('ADMIN','BOOKING_VIEW'),('ADMIN','BOOKING_MANAGE'),('ADMIN','PROVIDER_VIEW'),('ADMIN','PROVIDER_APPROVE'),
('ADMIN','USER_VIEW'),('ADMIN','USER_MANAGE'),('ADMIN','CATALOG_MANAGE'),('ADMIN','COUPON_MANAGE'),('ADMIN','NOTIFY_BROADCAST'),('ADMIN','AUDIT_VIEW');
INSERT INTO role_permissions(role_code,permission_code) SELECT 'SUPER_ADMIN', code FROM permissions;

-- Failed / successful sign-in trail used for lockout and forensics
CREATE TABLE login_attempts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  identifier VARCHAR(190) NOT NULL,
  ip_address VARCHAR(45) NULL,
  scope VARCHAR(10) NOT NULL DEFAULT 'CUSTOMER',   -- CUSTOMER / ADMIN
  success BOOLEAN NOT NULL,
  reason VARCHAR(60) NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  INDEX idx_la_ident (identifier, created_at),
  INDEX idx_la_ip (ip_address, created_at)
);

-- Admin sessions: every admin token carries a session id so a session can be revoked from the panel
CREATE TABLE admin_sessions (
  id CHAR(32) PRIMARY KEY,
  user_id BIGINT NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  last_seen_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP()),
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  CONSTRAINT fk_as_user FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_as_user (user_id, revoked_at)
);

ALTER TABLE audit_logs
  ADD COLUMN old_value JSON NULL,
  ADD COLUMN new_value JSON NULL,
  ADD COLUMN user_agent VARCHAR(255) NULL;

CREATE TABLE system_settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL,
  value_type VARCHAR(10) NOT NULL DEFAULT 'STRING',
  description VARCHAR(200) NULL,
  updated_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())
);
INSERT INTO system_settings(setting_key,setting_value,value_type,description) VALUES
('TAX_PERCENT','5','NUMBER','GST-style tax % applied on service amount'),
('PLATFORM_FEE','0','NUMBER','Flat platform fee per booking (INR)'),
('REQUEST_EXPIRY_MINUTES','30','NUMBER','Unaccepted booking auto-expires after N minutes'),
('ADMIN_SESSION_MINUTES','30','NUMBER','Admin access token lifetime'),
('ADMIN_MAX_FAILED_LOGINS','5','NUMBER','Admin lockout threshold'),
('ADMIN_LOCK_MINUTES','15','NUMBER','Admin lockout duration'),
('DEFAULT_SERVICE_RADIUS_KM','10','NUMBER','Default provider service radius'),
('SUPPORT_PHONE','','STRING','Shown in help screens');
