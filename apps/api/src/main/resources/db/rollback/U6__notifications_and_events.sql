DROP TABLE IF EXISTS notification_broadcasts, domain_events, device_tokens, notification_preferences;
ALTER TABLE notifications DROP COLUMN entity_type, DROP COLUMN entity_id, DROP COLUMN audience, DROP COLUMN priority, DROP COLUMN channel, DROP COLUMN data;
