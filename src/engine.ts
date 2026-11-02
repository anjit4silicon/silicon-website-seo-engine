import { defineSite, validateValues, type ContentValues, type SiteDefinition } from "./schema.js";
import type { ContentStore, PageRecord } from "./storage.js";

export class RevisionConflictError extends Error {
  constructor(pageId: string) {
    super(`Page ${pageId} changed since it was read.`);
  }
}

export function createContentEngine(siteInput: SiteDefinition, store: ContentStore) {
  const site = defineSite(siteInput);
  if (store.siteId && store.siteId !== site.id) throw new Error("Store site id does not match the site definition.");
  const pages = new Map(site.pages.map((page) => [page.id, page]));
  const fields = site.extensions?.fields ?? [];
  const pageFor = (id: string) => {
    const page = pages.get(id);
    if (!page) throw new Error(`Unregistered page: ${id}`);
    return page;
  };
  return {
    site,
    async seed(pageId: string, initial: ContentValues): Promise<PageRecord> {
      const values = validateValues(pageFor(pageId), initial, fields);
      const record: PageRecord = { pageId, revision: 0, schemaVersion: pageFor(pageId).schemaVersion ?? 1, draft: values, published: structuredClone(values), publishedRevision: 0 };
      if (!await store.put(pageId, null, record)) throw new RevisionConflictError(pageId);
      return record;
    },
    async read(pageId: string): Promise<PageRecord | null> {
      pageFor(pageId);
      return store.get(pageId);
    },
    async saveDraft(pageId: string, expectedRevision: number, input: ContentValues): Promise<PageRecord> {
      const draft = validateValues(pageFor(pageId), input, fields);
      const current = await store.get(pageId);
      if (!current || current.revision !== expectedRevision) throw new RevisionConflictError(pageId);
      if (current.schemaVersion !== (pageFor(pageId).schemaVersion ?? 1)) throw new Error(`Page ${pageId} needs a content schema migration.`);
      const next = { ...current, revision: current.revision + 1, draft };
      if (!await store.put(pageId, expectedRevision, next)) throw new RevisionConflictError(pageId);
      return next;
    },
    async publish(pageId: string, expectedRevision: number): Promise<PageRecord> {
      const current = await store.get(pageId);
      if (!current || current.revision !== expectedRevision) throw new RevisionConflictError(pageId);
      const published = validateValues(pageFor(pageId), current.draft, fields);
      const next = { ...current, revision: current.revision + 1, published, publishedRevision: current.revision + 1 };
      if (!await store.put(pageId, expectedRevision, next)) throw new RevisionConflictError(pageId);
      return next;
    },
    async migratePage(pageId: string, expectedRevision: number, transform: (values: ContentValues) => ContentValues, removedFields: readonly string[] = []): Promise<PageRecord> {
      const page = pageFor(pageId);
      const current = await store.get(pageId);
      if (!current || current.revision !== expectedRevision) throw new RevisionConflictError(pageId);
      const targetVersion = page.schemaVersion ?? 1;
      if (targetVersion <= current.schemaVersion) throw new Error(`Page ${pageId} needs a higher target schema version.`);
      const allowedRemovals = new Set(removedFields);
      const migrate = (source: ContentValues) => {
        const result = transform(structuredClone(source));
        for (const key of Object.keys(source)) {
          if (!(key in result) && !allowedRemovals.has(key)) throw new Error(`Migration would remove ${pageId}.${key} without explicit approval.`);
        }
        return validateValues(page, result, fields);
      };
      const next: PageRecord = {
        ...current, revision: current.revision + 1, schemaVersion: targetVersion, publishedRevision: current.revision + 1,
        draft: migrate(current.draft), published: migrate(current.published),
      };
      if (!await store.put(pageId, expectedRevision, next, "migration")) throw new RevisionConflictError(pageId);
      return next;
    },
    async published(pageId: string): Promise<ContentValues | null> {
      pageFor(pageId);
      return (await store.get(pageId))?.published ?? null;
    }
  };
}
