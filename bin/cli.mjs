#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import { defineSite, createContentEngine, validateValues } from "../dist/index.js";
import { PostgresContentStore } from "../dist/postgres.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const [command, ...args] = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1];
};
const connectionString = process.env.CONTENT_OS_DATABASE_URL;
if (!connectionString) {
  console.error("Set CONTENT_OS_DATABASE_URL for this website's database.");
  process.exitCode = 1;
} else {
  const pool = new pg.Pool({ connectionString, max: 2 });
  try {
    if (command === "migrate") {
      const client = await pool.connect();
      try {
        await client.query("SELECT pg_advisory_lock(hashtext('silicon-content-os-migrations'))");
        await client.query("CREATE TABLE IF NOT EXISTS silicon_content_schema_migrations (version integer PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
        const names = (await readdir(join(root, "migrations"))).filter((name) => /^\d+-[\w-]+\.sql$/.test(name)).sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]));
        const existing = await client.query("SELECT version,checksum FROM silicon_content_schema_migrations");
        const applied = new Map(existing.rows.map((row) => [row.version, row.checksum]));
        const versions = names.map((name) => Number(name.split("-")[0]));
        if (new Set(versions).size !== versions.length) throw new Error("Duplicate migration version.");
        for (const name of names) {
          const version = Number(name.split("-")[0]);
          const sql = await readFile(join(root, "migrations", name), "utf8");
          const checksum = createHash("sha256").update(sql).digest("hex");
          if (applied.has(version)) {
            if (applied.get(version) !== checksum) throw new Error(`Applied migration ${version} changed on disk.`);
            continue;
          }
          await client.query("BEGIN");
          try {
            await client.query(sql);
            await client.query("INSERT INTO silicon_content_schema_migrations (version,checksum) VALUES ($1,$2)", [version, checksum]);
            await client.query("COMMIT");
            console.log(`Applied migration ${name}`);
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          }
        }
        console.log("Database migrations are current.");
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext('silicon-content-os-migrations'))").catch(() => {});
        client.release();
      }
    } else if (command === "check") {
      const filename = option("--file");
      const moduleName = option("--module");
      if (Boolean(filename) === Boolean(moduleName)) throw new Error("Usage: silicon-content-os check --file content.json | --module site.mjs");
      const input = filename ? JSON.parse(await readFile(resolve(filename), "utf8")) : (await import(pathToFileURL(resolve(moduleName)).href)).default;
      const site = defineSite(input.site ?? input);
      const store = new PostgresContentStore(pool, site.id);
      let issues = 0;
      for (const page of site.pages) {
        const record = await store.get(page.id);
        if (!record) { console.error(`Missing page record: ${page.id}`); issues++; continue; }
        if (record.schemaVersion !== (page.schemaVersion ?? 1)) {
          console.error(`Schema version mismatch on ${page.id}: database ${record.schemaVersion}, site ${page.schemaVersion ?? 1}`);
          issues++;
          continue;
        }
        for (const [label, values] of [["draft", record.draft], ["published", record.published]]) {
          try { validateValues(page, values, site.extensions?.fields); }
          catch (error) { console.error(`Invalid ${label} on ${page.id}: ${error.message}`); issues++; }
        }
      }
      if (issues) throw new Error(`Compatibility check found ${issues} issue(s).`);
      console.log(`Site ${site.id} is compatible with its stored content.`);
    } else if (command === "create-admin") {
      const siteId = option("--site-id");
      const email = option("--email")?.trim().toLowerCase();
      const password = process.env.CONTENT_OS_ADMIN_PASSWORD;
      if (!siteId || !email || !password || password.length < 12) throw new Error("Usage: CONTENT_OS_ADMIN_PASSWORD=<12+ characters> silicon-content-os create-admin --site-id site-id --email admin@example.com");
      const store = new PostgresContentStore(pool, siteId);
      if (await store.getUserByEmail(email)) throw new Error("This account already exists.");
      const salt = randomBytes(16).toString("hex");
      const hash = await promisify(scryptCallback)(password, salt, 64);
      const ok = await store.putUser({ userId: randomUUID(), email, passwordHash: `${salt}:${hash.toString("hex")}`, role: "super-admin", active: true, metadata: {}, revision: 0 }, null);
      if (!ok) throw new Error("Could not create the admin account.");
      console.log(`Created editor for ${siteId}: ${email}`);
    } else if (command === "import") {
      const filename = option("--file");
      const moduleName = option("--module");
      if (Boolean(filename) === Boolean(moduleName)) throw new Error("Usage: silicon-content-os import --file content.json | --module content.mjs");
      const input = filename ? JSON.parse(await readFile(resolve(filename), "utf8")) : (await import(pathToFileURL(resolve(moduleName)).href)).default;
      const site = defineSite(input.site);
      if (!input.pages || typeof input.pages !== "object" || Array.isArray(input.pages)) throw new Error("Import needs a pages object.");
      const store = new PostgresContentStore(pool, site.id);
      const engine = createContentEngine(site, store);
      const entries = Object.entries(input.pages);
      for (const [pageId, values] of entries) {
        const page = site.pages.find((item) => item.id === pageId);
        if (!page) throw new Error(`Unregistered page in import: ${pageId}`);
        validateValues(page, values, site.extensions?.fields);
      }
      for (const [pageId, values] of entries) {
        if (await engine.read(pageId)) {
          console.log(`Skipped existing ${site.id}/${pageId}`);
          continue;
        }
        await engine.seed(pageId, values);
        console.log(`Seeded ${site.id}/${pageId}`);
      }
    } else {
      throw new Error("Usage: silicon-content-os migrate | import --file content.json | create-admin --site-id id --email address");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
