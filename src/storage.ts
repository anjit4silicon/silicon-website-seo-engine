import type { ContentValues } from "./schema.js";

export type PageRecord = {
  pageId: string;
  revision: number;
  schemaVersion: number;
  draft: ContentValues;
  published: ContentValues;
  publishedRevision: number;
};

/** Every website supplies durable, isolated storage with an atomic compare and write. */
export interface ContentStore {
  readonly siteId?: string;
  get(pageId: string): Promise<PageRecord | null>;
  put(pageId: string, expectedRevision: number | null, next: PageRecord, event?: "seed" | "draft" | "publish" | "migration"): Promise<boolean>;
}
