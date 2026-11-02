import type { ReactNode } from "react";
import { analyseSeo, type SeoCheckExtension } from "./seo.js";
import type { ContentValues, PageDefinition, SiteDefinition } from "./schema.js";
import type { PageRecord } from "./storage.js";

export type EditorAction = (formData: FormData) => Promise<void>;

export function readEditorForm(page: PageDefinition, formData: FormData): ContentValues {
  const values: ContentValues = {};
  for (const [key, field] of Object.entries(page.fields)) {
    const raw = formData.get(key);
    if (field.type === "boolean") values[key] = raw === "on";
    else if (field.type === "number") values[key] = raw === null || raw === "" ? null : Number(raw);
    else if (field.type === "custom") {
      if (typeof raw !== "string" || !raw.trim()) values[key] = null;
      else values[key] = JSON.parse(raw) as ContentValues[string];
    } else values[key] = typeof raw === "string" ? raw : "";
  }
  return values;
}

export function DashboardEditor({
  site, page, record, saveAction, publishAction, previewHref, seoChecks = [], children,
}: {
  site: SiteDefinition;
  page: PageDefinition;
  record: PageRecord;
  saveAction: EditorAction;
  publishAction: EditorAction;
  previewHref: string;
  seoChecks?: readonly SeoCheckExtension[];
  children?: ReactNode;
}) {
  const report = analyseSeo(page, record.draft, seoChecks);
  const pending = JSON.stringify(record.draft) !== JSON.stringify(record.published);
  return <main className="silicon-cms">
    <header className="silicon-cms__header">
      <div><p className="silicon-cms__eyebrow">{site.name} · Content OS</p><h1>{page.label}</h1><p>{page.path} · Draft revision {record.revision}</p></div>
      <a href={previewHref}>Preview draft</a>
    </header>
    <div className="silicon-cms__columns">
      <form action={saveAction} className="silicon-cms__panel">
        <h2>Content</h2>
        <input type="hidden" name="pageId" value={page.id} />
        <input type="hidden" name="revision" value={record.revision} />
        {Object.entries(page.fields).map(([key, field]) => <label key={key} className="silicon-cms__field">
          <span>{key}{field.required ? " *" : ""}</span>
          {field.type === "boolean"
            ? <input name={key} type="checkbox" defaultChecked={record.draft[key] === true} />
            : field.type === "richText" || field.type === "custom"
              ? <textarea name={key} rows={field.type === "custom" ? 4 : 7} defaultValue={field.type === "custom" ? JSON.stringify(record.draft[key] ?? null, null, 2) : String(record.draft[key] ?? "")} />
              : <input name={key} type={field.type === "number" ? "number" : "text"} required={field.required} defaultValue={String(record.draft[key] ?? "")} />}
        </label>)}
        <button type="submit">Save draft</button>
      </form>
      <aside className="silicon-cms__panel">
        <h2>SEO review · {report.score}/100</h2>
        <ul>{report.findings.map((finding) => <li key={finding.id}><strong>{finding.status}</strong> — {finding.message}</li>)}</ul>
        {children}
        <p>{pending ? "Saved draft differs from the public page." : "Draft matches the public page."}</p>
        <form action={publishAction}>
          <input type="hidden" name="pageId" value={page.id} />
          <input type="hidden" name="revision" value={record.revision} />
          <button type="submit" disabled={!pending}>Publish saved draft</button>
        </form>
      </aside>
    </div>
  </main>;
}
