import type { ContentValues, PageDefinition } from "./schema.js";

export type SeoFinding = {
  id: string;
  field: string | null;
  status: "pass" | "warning" | "critical" | "unavailable";
  message: string;
};
export type SeoReport = { score: number; findings: SeoFinding[] };
export type SeoCheckExtension = {
  id: string;
  run(page: PageDefinition, content: ContentValues): SeoFinding;
};

export function analyseSeo(page: PageDefinition, content: ContentValues, extensions: readonly SeoCheckExtension[] = []): SeoReport {
  const findings: SeoFinding[] = [];
  const add = (id: string, field: string | null, status: SeoFinding["status"], message: string) => findings.push({ id, field, status, message });
  if (!page.seo) {
    add("seo-fields", null, "unavailable", "Register SEO fields on this page to analyse its metadata.");
  } else {
  const title = content[page.seo.titleField];
  const description = page.seo.descriptionField ? content[page.seo.descriptionField] : undefined;
  if (typeof title !== "string" || !title.trim()) add("title", page.seo.titleField, "critical", "SEO title is missing.");
  else if (title.length > 60) add("title", page.seo.titleField, "warning", "SEO title may be truncated in search results.");
  else add("title", page.seo.titleField, "pass", "SEO title is present and within the suggested length.");
  if (!page.seo.descriptionField) add("description", null, "unavailable", "No meta description field is registered.");
  else if (typeof description !== "string" || !description.trim()) add("description", page.seo.descriptionField, "critical", "Meta description is missing.");
  else if (description.length > 160) add("description", page.seo.descriptionField, "warning", "Meta description may be truncated in search results.");
  else add("description", page.seo.descriptionField, "pass", "Meta description is present and within the suggested length.");
  const indexable = !page.seo.indexField || content[page.seo.indexField] !== false;
  add("indexing", page.seo.indexField ?? null, indexable ? "pass" : "warning", indexable ? "Page is eligible for indexing." : "Page is set to noindex.");
  }
  const ids = new Set(findings.map((item) => item.id));
  for (const extension of extensions) {
    if (ids.has(extension.id)) throw new Error(`Duplicate SEO check: ${extension.id}`);
    const result = extension.run(page, content);
    if (result.id !== extension.id) throw new Error(`SEO check identity mismatch: ${extension.id}`);
    ids.add(result.id);
    findings.push(result);
  }
  const scorable = findings.filter((item) => item.status !== "unavailable");
  const credits = { pass: 1, warning: 0.5, critical: 0, unavailable: 0 };
  return { score: scorable.length ? Math.round(scorable.reduce((sum, item) => sum + credits[item.status], 0) / scorable.length * 100) : 0, findings };
}
