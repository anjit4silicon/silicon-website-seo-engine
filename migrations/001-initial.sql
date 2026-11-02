CREATE TABLE IF NOT EXISTS silicon_content_pages (
  site_id text NOT NULL,
  page_id text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 0),
  draft jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
  published jsonb NOT NULL CHECK (jsonb_typeof(published) = 'object'),
  published_revision integer NOT NULL CHECK (published_revision >= 0 AND published_revision <= revision),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, page_id)
);

CREATE TABLE IF NOT EXISTS silicon_content_revisions (
  site_id text NOT NULL,
  page_id text NOT NULL,
  revision integer NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN ('seed', 'draft', 'publish', 'migration')),
  draft jsonb NOT NULL,
  published jsonb NOT NULL,
  published_revision integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, page_id, revision),
  FOREIGN KEY (site_id, page_id) REFERENCES silicon_content_pages(site_id, page_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS silicon_content_users (
  site_id text NOT NULL,
  user_id text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, user_id),
  UNIQUE (site_id, email)
);

CREATE TABLE IF NOT EXISTS silicon_content_settings (
  site_id text NOT NULL,
  setting_key text NOT NULL,
  value jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, setting_key)
);

CREATE TABLE IF NOT EXISTS silicon_content_media (
  site_id text NOT NULL,
  media_id text NOT NULL,
  filename text NOT NULL,
  content_type text NOT NULL,
  bytes bytea NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site_id, media_id)
);
