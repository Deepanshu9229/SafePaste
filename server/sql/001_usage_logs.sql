-- One row per AI request. Never stores the pasted text or the raw IP address.
CREATE TABLE IF NOT EXISTS usage_logs (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  endpoint       TEXT        NOT NULL,           -- 'scan', later 'clue-check' and 'ask'
  status         TEXT        NOT NULL,           -- ok, bad_request, forbidden, rate_limited, busy, timeout, model_error, aborted
  model          TEXT        NOT NULL,
  input_chars    INTEGER     NOT NULL,
  entity_counts  JSONB       NOT NULL DEFAULT '{}', -- e.g. {"PERSON": 2, "ADDRESS": 1}
  output_tokens  INTEGER,
  tokens_per_sec REAL,
  total_ms       INTEGER     NOT NULL,           -- request received to finished, queue wait included
  visitor_hash   TEXT        NOT NULL            -- sha256(ip | UTC date | secret), changes every day
);

CREATE INDEX IF NOT EXISTS usage_logs_created_at_idx ON usage_logs (created_at);
