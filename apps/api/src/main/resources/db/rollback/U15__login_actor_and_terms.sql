-- Manual rollback for V15 (take a backup first; see README.md).
ALTER TABLE users DROP COLUMN terms_accepted_at, DROP COLUMN terms_version;
ALTER TABLE refresh_tokens DROP COLUMN actor;
