import pg from "pg";
import type { ContentStore, PageRecord } from "./storage.js";
import type { JsonValue } from "./schema.js";

const { Pool } = pg;

export type SiteUserRecord = {
  userId: string;
  email: string;
  passwordHash: string;
  role: string;
  active: boolean;
  metadata: Record<string, JsonValue>;
  revision: number;
};
export type SiteSettingRecord = { key: string; value: JsonValue; revision: number };
export type SiteMediaRecord = { id: string; filename: string; contentType: string; bytes: Buffer; metadata: Record<string, JsonValue> };

export class PostgresContentStore implements ContentStore {
  constructor(readonly pool: pg.Pool, readonly siteId: string) {
    if (!/^[a-z][a-z0-9-]*$/.test(siteId)) throw new Error("A valid site id is required.");
  }

  async get(pageId: string): Promise<PageRecord | null> {
    const result = await this.pool.query<{
      page_id: string; revision: number; schema_version: number; draft: PageRecord["draft"];
      published: PageRecord["published"]; published_revision: number;
    }>(
      "SELECT page_id, revision, schema_version, draft, published, published_revision FROM silicon_content_pages WHERE site_id = $1 AND page_id = $2",
      [this.siteId, pageId],
    );
    const row = result.rows[0];
    return row ? { pageId: row.page_id, revision: row.revision, schemaVersion: row.schema_version, draft: row.draft, published: row.published, publishedRevision: row.published_revision } : null;
  }

  async put(pageId: string, expectedRevision: number | null, next: PageRecord, eventKind?: "seed" | "draft" | "publish" | "migration"): Promise<boolean> {
    if (next.pageId !== pageId || next.revision !== (expectedRevision === null ? 0 : expectedRevision + 1)) {
      throw new Error("Page record identity or revision is invalid.");
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const values = [this.siteId, pageId, next.revision, JSON.stringify(next.draft), JSON.stringify(next.published), next.publishedRevision, next.schemaVersion];
      const result = expectedRevision === null
        ? await client.query(
          "INSERT INTO silicon_content_pages (site_id, page_id, revision, draft, published, published_revision, schema_version) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7) ON CONFLICT DO NOTHING",
          values,
        )
        : await client.query(
          "UPDATE silicon_content_pages SET revision=$3, draft=$4::jsonb, published=$5::jsonb, published_revision=$6, schema_version=$7, updated_at=now(), published_at=CASE WHEN published_revision <> $6 THEN now() ELSE published_at END WHERE site_id=$1 AND page_id=$2 AND revision=$8",
          [...values, expectedRevision],
        );
      if (result.rowCount !== 1) {
        await client.query("ROLLBACK");
        return false;
      }
      const event = eventKind ?? (expectedRevision === null ? "seed" : next.publishedRevision > expectedRevision ? "publish" : "draft");
      await client.query(
        "INSERT INTO silicon_content_revisions (site_id,page_id,revision,event_kind,draft,published,published_revision,schema_version) VALUES ($1,$2,$3,$8,$4::jsonb,$5::jsonb,$6,$7)",
        [...values, event],
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async listPageRevisions(pageId: string) {
    const result = await this.pool.query<{ revision: number; event_kind: string; created_at: Date }>(
      "SELECT revision,event_kind,created_at FROM silicon_content_revisions WHERE site_id=$1 AND page_id=$2 ORDER BY revision DESC",
      [this.siteId, pageId],
    );
    return result.rows.map((row) => ({ revision: row.revision, event: row.event_kind, at: row.created_at.toISOString() }));
  }

  async getSetting(key: string): Promise<SiteSettingRecord | null> {
    const result = await this.pool.query<{ value: JsonValue; revision: number }>(
      "SELECT value,revision FROM silicon_content_settings WHERE site_id=$1 AND setting_key=$2", [this.siteId, key],
    );
    return result.rows[0] ? { key, ...result.rows[0] } : null;
  }

  async putSetting(key: string, value: JsonValue, expectedRevision: number | null): Promise<boolean> {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new Error("Setting must be JSON.");
    const result = expectedRevision === null
      ? await this.pool.query("INSERT INTO silicon_content_settings (site_id,setting_key,value) VALUES ($1,$2,$3::jsonb) ON CONFLICT DO NOTHING", [this.siteId, key, encoded])
      : await this.pool.query("UPDATE silicon_content_settings SET value=$3::jsonb,revision=revision+1,updated_at=now() WHERE site_id=$1 AND setting_key=$2 AND revision=$4", [this.siteId, key, encoded, expectedRevision]);
    return result.rowCount === 1;
  }

  async getUser(userId: string): Promise<SiteUserRecord | null> {
    const result = await this.pool.query<{
      user_id: string; email: string; password_hash: string; role: string; active: boolean;
      metadata: Record<string, JsonValue>; revision: number;
    }>("SELECT user_id,email,password_hash,role,active,metadata,revision FROM silicon_content_users WHERE site_id=$1 AND user_id=$2", [this.siteId, userId]);
    const row = result.rows[0];
    return row ? { userId: row.user_id, email: row.email, passwordHash: row.password_hash, role: row.role, active: row.active, metadata: row.metadata, revision: row.revision } : null;
  }

  async allowLoginAttempt(identityHash: string): Promise<boolean> {
    const result = await this.pool.query<{ attempts: number }>(
      `INSERT INTO silicon_content_login_attempts (site_id,identity_hash) VALUES ($1,$2)
       ON CONFLICT (site_id,identity_hash) DO UPDATE SET
         attempts = CASE WHEN silicon_content_login_attempts.window_started_at < now() - interval '15 minutes'
           THEN 1 ELSE silicon_content_login_attempts.attempts + 1 END,
         window_started_at = CASE WHEN silicon_content_login_attempts.window_started_at < now() - interval '15 minutes'
           THEN now() ELSE silicon_content_login_attempts.window_started_at END
       RETURNING attempts`,
      [this.siteId, identityHash],
    );
    return (result.rows[0]?.attempts ?? 99) <= 10;
  }

  async getUserByEmail(email: string): Promise<SiteUserRecord | null> {
    const result = await this.pool.query<{ user_id: string }>(
      "SELECT user_id FROM silicon_content_users WHERE site_id=$1 AND email=$2",
      [this.siteId, email.trim().toLowerCase()],
    );
    return result.rows[0] ? this.getUser(result.rows[0].user_id) : null;
  }

  async putUser(user: SiteUserRecord, expectedRevision: number | null): Promise<boolean> {
    if (user.revision !== (expectedRevision === null ? 0 : expectedRevision + 1)) throw new Error("User revision is invalid.");
    const values = [this.siteId, user.userId, user.email.toLowerCase(), user.passwordHash, user.role, user.active, JSON.stringify(user.metadata), user.revision];
    const result = expectedRevision === null
      ? await this.pool.query("INSERT INTO silicon_content_users (site_id,user_id,email,password_hash,role,active,metadata,revision) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) ON CONFLICT DO NOTHING", values)
      : await this.pool.query("UPDATE silicon_content_users SET email=$3,password_hash=$4,role=$5,active=$6,metadata=$7::jsonb,revision=$8,updated_at=now() WHERE site_id=$1 AND user_id=$2 AND revision=$9", [...values, expectedRevision]);
    return result.rowCount === 1;
  }

  async getMedia(mediaId: string): Promise<SiteMediaRecord | null> {
    const result = await this.pool.query<{ media_id: string; filename: string; content_type: string; bytes: Buffer; metadata: Record<string, JsonValue> }>(
      "SELECT media_id,filename,content_type,bytes,metadata FROM silicon_content_media WHERE site_id=$1 AND media_id=$2",
      [this.siteId, mediaId],
    );
    const row = result.rows[0];
    return row ? { id: row.media_id, filename: row.filename, contentType: row.content_type, bytes: row.bytes, metadata: row.metadata } : null;
  }

  async addMedia(media: SiteMediaRecord): Promise<boolean> {
    const result = await this.pool.query(
      "INSERT INTO silicon_content_media (site_id,media_id,filename,content_type,bytes,metadata) VALUES ($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT DO NOTHING",
      [this.siteId, media.id, media.filename, media.contentType, media.bytes, JSON.stringify(media.metadata)],
    );
    return result.rowCount === 1;
  }
}

export function createPostgresPool(connectionString: string): pg.Pool {
  if (!connectionString) throw new Error("PostgreSQL connection string is required.");
  return new Pool({ connectionString, max: 5 });
}
