export type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };
export type ContentValues = Record<string, JsonValue>;

export type FieldDefinition =
  | { type: "text" | "richText"; required?: boolean; maxLength?: number }
  | { type: "image"; required?: boolean }
  | { type: "boolean" | "number"; required?: boolean }
  | { type: "custom"; kind: string; required?: boolean };

export type CustomFieldExtension = {
  kind: string;
  /** Validate a JSON value before it enters the content store. */
  validate(value: JsonValue): boolean;
};

export type PageDefinition = {
  id: string;
  path: string;
  label: string;
  schemaVersion?: number;
  fields: Record<string, FieldDefinition>;
  seo?: { titleField: string; descriptionField?: string; indexField?: string };
};

export type SiteDefinition = {
  id: string;
  name: string;
  pages: readonly PageDefinition[];
  extensions?: { fields?: readonly CustomFieldExtension[] };
};

const idPattern = /^[a-z][a-z0-9-]*$/;
const fieldKeyPattern = /^[a-z][A-Za-z0-9]*$/;
const pathPattern = /^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/;

function isJson(value: unknown, seen = new Set<object>()): value is JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) return value.every((entry) => isJson(entry, seen));
  if (Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every((entry) => isJson(entry, seen));
}

export function defineSite(site: SiteDefinition): SiteDefinition {
  if (!idPattern.test(site.id) || !site.name.trim()) throw new Error("Site needs a valid id and name.");
  if (!site.pages.length) throw new Error("Site needs at least one managed page.");
  const ids = new Set<string>();
  const paths = new Set<string>();
  const kinds = new Set<string>();
  for (const extension of site.extensions?.fields ?? []) {
    if (!idPattern.test(extension.kind) || kinds.has(extension.kind) || typeof extension.validate !== "function") {
      throw new Error(`Invalid or duplicate custom field kind: ${extension.kind}`);
    }
    kinds.add(extension.kind);
  }
  for (const page of site.pages) {
    if (!idPattern.test(page.id) || !pathPattern.test(page.path)) throw new Error(`Invalid page id or path: ${page.id}`);
    if (ids.has(page.id) || paths.has(page.path)) throw new Error(`Duplicate page id or path: ${page.id}`);
    if (page.schemaVersion !== undefined && (!Number.isInteger(page.schemaVersion) || page.schemaVersion < 1)) throw new Error(`Invalid schema version: ${page.id}`);
    if (!page.label.trim() || !Object.keys(page.fields).length) throw new Error(`Incomplete page: ${page.id}`);
    for (const [key, field] of Object.entries(page.fields)) {
      if (!fieldKeyPattern.test(key)) throw new Error(`Invalid field key: ${page.id}.${key}`);
      if (field.type === "custom" && !kinds.has(field.kind)) throw new Error(`Missing custom field extension: ${field.kind}`);
      if ("maxLength" in field && field.maxLength !== undefined && (!Number.isInteger(field.maxLength) || field.maxLength < 1)) {
        throw new Error(`Invalid maximum length: ${page.id}.${key}`);
      }
    }
    if (page.seo) {
      for (const key of [page.seo.titleField, page.seo.descriptionField]) {
        if (key && !page.fields[key]) throw new Error(`SEO field is not registered: ${page.id}.${key}`);
        if (key && page.fields[key]?.type !== "text") throw new Error(`SEO title and description fields must be text: ${page.id}.${key}`);
      }
      if (page.seo.indexField && page.fields[page.seo.indexField]?.type !== "boolean") {
        throw new Error(`SEO index field must be boolean: ${page.id}.${page.seo.indexField}`);
      }
    }
    ids.add(page.id);
    paths.add(page.path);
  }
  return site;
}

export function validateValues(page: PageDefinition, input: unknown, extensions: readonly CustomFieldExtension[] = []): ContentValues {
  if (!input || typeof input !== "object" || Array.isArray(input) || !isJson(input)) {
    throw new Error(`Content for ${page.id} must be a JSON object.`);
  }
  const values = input as ContentValues;
  const customFields = new Map(extensions.map((extension) => [extension.kind, extension]));
  for (const key of Object.keys(values)) {
    if (!Object.hasOwn(page.fields, key)) throw new Error(`Unknown field: ${page.id}.${key}`);
  }
  for (const [key, field] of Object.entries(page.fields)) {
    const value = values[key];
    if (value === undefined || value === null || value === "") {
      if (field.required) throw new Error(`Required field is empty: ${page.id}.${key}`);
      continue;
    }
    if (field.type === "boolean") {
      if (typeof value !== "boolean") throw new Error(`Expected boolean: ${page.id}.${key}`);
    } else if (field.type === "number") {
      if (typeof value !== "number") throw new Error(`Expected number: ${page.id}.${key}`);
    } else if (field.type === "custom") {
      if (!customFields.get(field.kind)?.validate(value)) throw new Error(`Invalid custom field: ${page.id}.${key}`);
    } else {
      if (typeof value !== "string") throw new Error(`Expected text: ${page.id}.${key}`);
      if ("maxLength" in field && field.maxLength && value.length > field.maxLength) throw new Error(`Text is too long: ${page.id}.${key}`);
      if (field.type === "image" && (!value.startsWith("/") || value.startsWith("//") || value.includes(".."))) {
        throw new Error(`Expected site image path: ${page.id}.${key}`);
      }
    }
  }
  return structuredClone(values);
}
