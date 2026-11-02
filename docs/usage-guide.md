# Developer usage guide

This guide covers the current working integration for Next.js 16.4.x and React 19.3.x. The library is private and local while development continues. Use a Git dependency, private registry, or local package path for another project; the example uses a local path. A website owns its database, design, schemas, and extensions.

## 1. Install and configure

In the website project, install the current local package with `npm install /absolute/path/to/silicon-website-seo-engine`. Later, install a version from the chosen private registry. Add `CONTENT_OS_DATABASE_URL`, `CONTENT_OS_SESSION_SECRET` (32+ random characters), and `NEXT_PUBLIC_SITE_URL` to the website environment. Build the library before local installation with `npm run build`. The example app is in `examples/next-site`. Use a separate database for each website and environment.

Run the package CLI against that database. The CLI reads `CONTENT_OS_DATABASE_URL` from the process environment; a Next.js `.env.local` file is not automatically loaded by a standalone CLI. With Node 20.9+, use:

```sh
node --env-file=.env.local node_modules/@silicon/website-seo-engine/bin/cli.mjs migrate
node --env-file=.env.local node_modules/@silicon/website-seo-engine/bin/cli.mjs import --file content.json
CONTENT_OS_ADMIN_PASSWORD='a-long-unique-password' node --env-file=.env.local node_modules/@silicon/website-seo-engine/bin/cli.mjs create-admin --site-id example-site --email editor@example.com
```

The import file registers the same pages and fields as the website's source configuration and seeds the initial published content. Existing page records are skipped. Keep the import file under source control without secrets.

## 2. Define the website

Create a site-owned `site.ts` with `defineSite({ id, name, pages })`. Each page has an id, path, label, fields, and optional `seo` mapping. Site-specific fields and renderers stay in the website. Built-in field types are text, richText (plain text in this first editor), number, boolean, and image path. Custom fields may register validators; their editor control is currently a JSON textarea.

Create a PostgreSQL pool, `PostgresContentStore(pool, site.id)`, `createContentEngine(site, store)`, and `createNextIntegration({ engine, authorize, siteUrl })`. The included `createDashboardAuth({ store, secret })` supplies a local editor login; a website may supply its own authorization callback.

## 3. Connect public routes

Each page component reads `cms.published(pageId)` and passes the returned values into that site's existing React design. Wrap the dynamic content component in `Suspense` when Cache Components is enabled. The page's `generateMetadata` can return `cms.metadata(pageId)`. Connect the site's `app/sitemap.ts` and `app/robots.ts` to `cms.sitemap()` and `cms.robots()`.

The public read never returns drafts. After publishing, the adapter revalidates the page path.

## 4. Add dashboard routes

The site owns its App Router files. Use `DashboardEditor` from `@silicon/website-seo-engine/dashboard` inside a protected dashboard page. The package renders a basic field editor and starter SEO report; the site supplies Server Actions for save and publish. Parse the form with `readEditorForm(page, data)`, then call `cms.saveDraft` or `cms.publish`. Use `cms.draft` for an authorized preview rendered by the site's own page components.

Import `@silicon/website-seo-engine/dashboard.css` once in the site's root layout. Override `--silicon-accent`, `--silicon-surface`, `--silicon-text`, and `--silicon-border` in site CSS to customize its appearance without editing the package.

The example app contains complete route wrappers and a login form. Copy their pattern, then replace the example About component and schema with the website's design.

## 5. Upgrade safely

Upgrade the package version, run `silicon-content-os migrate`, and review changes to the site schema. Package updates do not edit site files or overwrite content. If a page's fields change, raise its `schemaVersion` and run `engine.migratePage` with an explicit transform for both draft and published content. Removing a field requires naming it in the migration's `removedFields` list. Then build and deploy the website.

## Current limits

This is a working early integration, not the complete CCA feature set. The starter SEO report covers metadata length and indexability. The full CCA rule set, rich content blocks, media uploads, roles and permissions beyond editor access, AI, Google integrations, advanced link graph, and Core Web Vitals are still planned. The included sign-in has database-backed attempt limiting; deployments should still use HTTPS and their normal infrastructure protections.

## Compatibility checks and site SEO extensions

Before deploying an update, run `node --env-file=.env.local node_modules/@silicon/website-seo-engine/bin/cli.mjs check --file content.json` against that environment's database. A module can be supplied with `--module` when the site uses custom validator functions. The check reports missing records, schema version mismatches, and draft or published values that no longer fit the site schema.

A site can pass `seoChecks` to `DashboardEditor`. Each check has a stable id and a `run(page, content)` function returning an SEO finding. Keep those functions in the website project. A library upgrade cannot replace them.
