ALTER TABLE silicon_content_pages
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1);

ALTER TABLE silicon_content_revisions
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version >= 1);
