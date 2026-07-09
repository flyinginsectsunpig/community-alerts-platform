-- Accounts (required for commenting; reporting stays anonymous by design)
-- and flat per-alert discussion threads.

CREATE TABLE users (
    id            UUID PRIMARY KEY,
    email         VARCHAR(254) NOT NULL UNIQUE,
    display_name  VARCHAR(60)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE alert_comments (
    id         BIGSERIAL PRIMARY KEY,
    alert_id   UUID        NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    body       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_alert ON alert_comments (alert_id, created_at);

ALTER TABLE alerts ADD COLUMN comment_count INT NOT NULL DEFAULT 0;

-- Watch zones created while signed in are linked to the account.
ALTER TABLE watch_zones ADD COLUMN user_id UUID REFERENCES users (id) ON DELETE SET NULL;
