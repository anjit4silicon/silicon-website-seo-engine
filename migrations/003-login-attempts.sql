CREATE TABLE IF NOT EXISTS silicon_content_login_attempts (
  site_id text NOT NULL,
  identity_hash text NOT NULL,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 1,
  PRIMARY KEY (site_id, identity_hash)
);
