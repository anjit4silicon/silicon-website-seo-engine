# Integration contract

The website owns its `SiteDefinition`, React renderers, routes, theme, content, users, and credentials. The library owns shared behavior. A package update cannot rewrite site-owned files.

## Current public API

Import `defineSite`, `validateValues`, and `createContentEngine` from the package root. Implement `ContentStore` with atomic compare-and-write semantics. Use one store namespace or database per website. Site and page IDs use lowercase letters, numbers, and hyphens. Field keys use letters and numbers and may be camelCase. Page paths are normalized absolute paths. Content is JSON, so it can be persisted and migrated.

A custom field supplies a named validator through `extensions.fields`. The name is stable data schema: changing or removing it requires a site migration. The current dashboard edits custom fields through a JSON textarea; a dedicated control can be added by a future UI extension.

`seed` creates the first draft and published snapshot. `saveDraft` changes only the draft. `publish` copies the current draft into the published snapshot. Public routes read through `published`; draft reads require authorization supplied by the Next.js integration.

## Version and compatibility policy

Before 1.0, API changes are permitted in minor versions and documented in CHANGELOG.md. After 1.0, use semantic versioning: patch for fixes, minor for additive compatible features, major for breaking contracts. Workflow changes require explicit site opt-in. Database migrations must preserve site content and custom fields; publish migrations before using a new engine version. Release only after build, API compatibility, migration, and example-site checks pass.

Supported baseline for the Next.js binding: Node 20.9+, Next.js 16.4.x, React 19.3.x. The current core has no runtime Next.js dependency. Support for other versions will be added only after integration verification.

## Release procedure

Update CHANGELOG.md, run `npm run build`, inspect `npm pack --dry-run`, and bump the version with `npm version patch|minor|major`. Keep `private: true` until the installable product and a registry are ready. Do not publish the current foundation as a complete CMS.
