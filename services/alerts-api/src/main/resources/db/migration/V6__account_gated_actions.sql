-- Community-visible actions (reports, confirmations, comments) now require an
-- account. Legacy rows stay anonymous, so both new columns are nullable.
ALTER TABLE alerts ADD COLUMN reported_by_user_id UUID REFERENCES users(id);

ALTER TABLE alert_confirmations ADD COLUMN user_id UUID REFERENCES users(id);

-- Uniqueness moves from device fingerprint to account: one confirmation per
-- user per alert, regardless of which device it came from.
ALTER TABLE alert_confirmations DROP CONSTRAINT uq_confirmation;
CREATE UNIQUE INDEX uq_confirmation_user
    ON alert_confirmations (alert_id, user_id)
    WHERE user_id IS NOT NULL;
