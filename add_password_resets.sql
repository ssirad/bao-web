-- Solo se il tuo database non ha ancora questa tabella (la crea la guida, fase 3).
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created    TEXT NOT NULL,
  expires    TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_resets_email ON password_resets(email);
