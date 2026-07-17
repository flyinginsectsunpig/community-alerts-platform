-- Browser push subscriptions for watch-zone notifications. Ownership uses the
-- same either-or model as watch_zones: an account, or an anonymous device
-- fingerprint. The endpoint is a capability URL and unique per device+app.
CREATE TABLE push_subscriptions (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id           UUID REFERENCES users(id),
    owner_fingerprint VARCHAR(64),
    endpoint          TEXT NOT NULL UNIQUE,
    p256dh            TEXT NOT NULL,
    auth              TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_push_owner CHECK ((user_id IS NULL) <> (owner_fingerprint IS NULL))
);

CREATE INDEX idx_push_subs_user ON push_subscriptions (user_id)
    WHERE user_id IS NOT NULL;
CREATE INDEX idx_push_subs_fp ON push_subscriptions (owner_fingerprint)
    WHERE owner_fingerprint IS NOT NULL;
