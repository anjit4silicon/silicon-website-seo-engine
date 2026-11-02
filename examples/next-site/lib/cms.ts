import { createContentEngine } from "@silicon/website-seo-engine";
import { createPostgresPool, PostgresContentStore } from "@silicon/website-seo-engine/postgres";
import { createDashboardAuth } from "@silicon/website-seo-engine/auth";
import { createNextIntegration } from "@silicon/website-seo-engine/next";
import { site } from "./site";

const databaseUrl = process.env.CONTENT_OS_DATABASE_URL;
const sessionSecret = process.env.CONTENT_OS_SESSION_SECRET;
if (!databaseUrl || !sessionSecret) throw new Error("Set CONTENT_OS_DATABASE_URL and CONTENT_OS_SESSION_SECRET.");

const pool = createPostgresPool(databaseUrl);
export const store = new PostgresContentStore(pool, site.id);
export const engine = createContentEngine(site, store);
export const auth = createDashboardAuth({ store, secret: sessionSecret });
export const cms = createNextIntegration({
  engine,
  authorize: () => auth.authorize(),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
});
