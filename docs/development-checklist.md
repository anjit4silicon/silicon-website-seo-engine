# Development checklist

## Phase 1 — Package foundation

- [x] Create a separate Git repository and package.
- [x] Define site, page, field, content, and storage contracts.
- [x] Define a custom field validation extension point.
- [x] Set a supported runtime and framework baseline.
- [x] Configure declaration output, package exports, and prepack build.
- [x] Define a version and changelog workflow.

## Phase 2 — Content and database

- [x] PostgreSQL adapter and versioned migrations.
- [x] Persistent pages, drafts, approved snapshots, revisions, users, settings, and media.
- [x] Import and seed tooling for an existing website.
- [x] Preservation and migration of custom page fields.

## Phase 3 — Next.js integration

- [x] App Router bindings and site-owned route wrappers.
- [x] Published and authorized draft reads.
- [x] Preview, cache invalidation, metadata, sitemap, and robots integration.

## Phase 4 — Dashboard

- [x] Site-local sign-in and a basic schema-driven editor.

- [ ] Authentication, sessions, roles, and permissions.
- [ ] Schema-driven page editor, preview, publishing, and history.
- [ ] Media, site settings, theme, and dashboard extension slots.

## Phase 5 — SEO engine

- [x] Starter metadata/indexing checks and custom check hook.

- [ ] Reusable checks, scoring, recommendations, and field links.
- [ ] Site-wide reports and custom SEO check extension points.

## Phase 6 — Optional features

- [ ] AI providers, usage limits, and recommendation review.
- [ ] Search Console, Analytics, sitemap submission, and indexing inspection.
- [ ] Feature flags for changes to editorial workflow.

## Phase 7 — Installation and upgrades

- [x] Developer usage guide, compatibility CLI, and one working example Next.js site.

- [ ] Setup CLI and starter integration.
- [ ] Route discovery and reviewed content mapping.
- [ ] Upgrade compatibility checks and migrations.
- [ ] Complete example website and a second, differently designed integration.
