-- V15: one mobile number can be both a Consumer and a Dialoo Partner, but every login session now belongs to exactly ONE of them.
-- refresh_tokens.actor keeps that choice across silent token refreshes; users.terms_* records which Terms version was accepted and when.
ALTER TABLE refresh_tokens ADD COLUMN actor VARCHAR(12) NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE users ADD COLUMN terms_version VARCHAR(20) NULL, ADD COLUMN terms_accepted_at DATETIME NULL;
