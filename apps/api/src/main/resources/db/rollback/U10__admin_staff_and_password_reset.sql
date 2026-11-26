DELETE FROM role_permissions WHERE permission_code='LOCATION_MANAGE';
DELETE FROM permissions WHERE code='LOCATION_MANAGE';
DROP TABLE IF EXISTS admin_password_resets;
ALTER TABLE users DROP COLUMN must_change_password;
