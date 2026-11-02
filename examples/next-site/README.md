# Example Next.js website

This example has its own About page design, page schema, database records, and dashboard routes. It consumes the library from the repository root.

## Run locally

1. Start an empty PostgreSQL database and copy `.env.example` to `.env.local`. Set its URL and a random session secret.
2. From the library root, run `npm install && npm run build`.
3. In this directory, run `npm install`.
4. Run the setup commands from [the usage guide](../../docs/usage-guide.md) with `content.json` as the import file and `example-site` as the site id.
5. Run `npm run dev`. Open `/about` for the public page and `/dashboard` for editing.

The public page reads only published content. The preview route reads drafts after authentication. This example demonstrates the integration contract; its design and schema are intentionally small.
