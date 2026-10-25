-- The reporter says the danger is still happening right now. Feeds the
-- opt-in ongoing-danger warnings; only some categories can set it.
ALTER TABLE alerts ADD COLUMN ongoing BOOLEAN NOT NULL DEFAULT false;
