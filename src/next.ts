import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import type { Metadata, MetadataRoute } from "next";
import type { ContentValues, SiteDefinition } from "./schema.js";
import type { PageRecord } from "./storage.js";

export type ContentEngine = {
  site: SiteDefinition;
  read(pageId: string): Promise<PageRecord | null>;
  saveDraft(pageId: string, expectedRevision: number, values: ContentValues): Promise<PageRecord>;
  publish(pageId: string, expectedRevision: number): Promise<PageRecord>;
  published(pageId: string): Promise<ContentValues | null>;
};

export type NextIntegrationOptions = {
  engine: ContentEngine;
  /** The site's own session and permission check. Throw or return false to deny access. */
  authorize: () => Promise<boolean>;
  siteUrl: string;
};

export function createNextIntegration({ engine, authorize, siteUrl }: NextIntegrationOptions) {
  const origin = new URL(siteUrl).origin;
  const pageFor = (pageId: string) => {
    const page = engine.site.pages.find((item) => item.id === pageId);
    if (!page) throw new Error(`Unregistered page: ${pageId}`);
    return page;
  };
  const requireEditor = async () => {
    if (!await authorize()) throw new Error("CMS editor access denied.");
  };
  const published = async (pageId: string) => {
    await connection();
    pageFor(pageId);
    return engine.published(pageId);
  };
  return {
    site: engine.site,
    published,
    async draft(pageId: string): Promise<PageRecord | null> {
      await requireEditor();
      pageFor(pageId);
      return engine.read(pageId);
    },
    async saveDraft(pageId: string, revision: number, values: ContentValues): Promise<PageRecord> {
      await requireEditor();
      return engine.saveDraft(pageId, revision, values);
    },
    async publish(pageId: string, revision: number): Promise<PageRecord> {
      await requireEditor();
      const record = await engine.publish(pageId, revision);
      revalidatePath(pageFor(pageId).path);
      return record;
    },
    async metadata(pageId: string): Promise<Metadata> {
      const page = pageFor(pageId);
      const values = await published(pageId);
      if (!values) return {};
      const seo = page.seo;
      const title = seo && typeof values[seo.titleField] === "string" ? values[seo.titleField] as string : page.label;
      const description = seo?.descriptionField && typeof values[seo.descriptionField] === "string" ? values[seo.descriptionField] as string : undefined;
      const index = !seo?.indexField || values[seo.indexField] !== false;
      return {
        title,
        description,
        alternates: { canonical: new URL(page.path, origin).toString() },
        robots: { index, follow: index },
      };
    },
    async sitemap(): Promise<MetadataRoute.Sitemap> {
      const entries: MetadataRoute.Sitemap = [];
      for (const page of engine.site.pages) {
        const values = await published(page.id);
        if (!values || page.seo?.indexField && values[page.seo.indexField] === false) continue;
        entries.push({ url: new URL(page.path, origin).toString() });
      }
      return entries;
    },
    robots(): MetadataRoute.Robots {
      return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/api/"] }], sitemap: new URL("/sitemap.xml", origin).toString() };
    },
  };
}
