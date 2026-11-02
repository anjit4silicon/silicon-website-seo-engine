# Silicon Website SEO Engine

A reusable CMS and SEO engine for Next.js websites. This repository contains an early Next.js integration with a basic dashboard editor. The package remains private while broader features are built.

Each website hosts its own dashboard and database and owns its routes, designs, schemas, branding, credentials, and content. The library supplies shared editing, publishing, SEO, and dashboard behavior.

The current package implements site and page definitions, JSON field validation, a custom field validator hook, PostgreSQL storage, versioned migrations, content imports, and seed, draft, publish, and published-read operations. See [the example](examples/site-definition.ts) and [integration contract](docs/integration-contract.md).

Development follows the [phase checklist](docs/development-checklist.md). The basic Next.js binding, editor, local sign-in, and starter SEO report are implemented. The complete CCA rule set, media UI, AI and Google integrations, and installer are still pending. Database setup is documented in [database.md](docs/database.md).

Run `npm install` and `npm run build` for local package development. Releases remain private until a complete site can install and use the engine.

For a new website, follow the [developer usage guide](docs/usage-guide.md) and the [example Next.js site](examples/next-site).
