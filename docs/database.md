# Database and content imports

Set `CONTENT_OS_DATABASE_URL` to a database owned by the website. Run `npm run db:migrate` in this repository, or `npx silicon-content-os migrate` after installing the package. Migrations are numbered SQL files. The runner records SHA-256 checksums and rejects edits to already applied migrations. Never point two unrelated websites at the same site ID in one database.

PostgreSQL stores pages, complete revision snapshots, users, settings, media, and login attempt counters. Every table is keyed by `site_id`, and page writes compare revisions atomically. Media bytes are stored in PostgreSQL for now; Phase 4 will add upload validation and serving.

To seed a site, run `npm run db:import -- --file examples/import-content.json`. The JSON contains a site definition and initial content. Existing pages are skipped, never overwritten. For custom field validators, use `--module path/to/import.mjs` with a default export shaped like the JSON example and executable extension functions. The tool validates all supplied pages before writing any. Importing across several pages is resumable, but not one transaction.

A page definition may set `schemaVersion` (default 1). If it changes, normal draft and publish operations stop until the website runs an explicit content migration. Call `engine.migratePage(pageId, expectedRevision, transform, removedFields)`. The transform runs against both draft and published snapshots. Removed fields must be listed explicitly; all resulting content must pass the new schema. The revision history retains pre-migration snapshots. A migration that renames a field should copy its value in the transform, then list the old key as removed.

Database migrations and site content migrations are different: SQL migrations evolve the library's tables; site content migrations evolve a website's page fields. Neither runs silently during a package upgrade.
