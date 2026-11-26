DROP TABLE IF EXISTS system_settings, admin_sessions, login_attempts, role_permissions, permissions, roles;
ALTER TABLE audit_logs DROP COLUMN old_value, DROP COLUMN new_value, DROP COLUMN user_agent;
ALTER TABLE users DROP COLUMN failed_login_count, DROP COLUMN locked_until, DROP COLUMN password_changed_at, DROP COLUMN token_version,
  DROP COLUMN last_login_ip, DROP COLUMN avatar_url, DROP COLUMN updated_at;
