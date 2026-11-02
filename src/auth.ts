import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import type { PostgresContentStore, SiteUserRecord } from "./postgres.js";

const scrypt = promisify(scryptCallback);
const TTL_SECONDS = 8 * 60 * 60;

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Password must have at least 12 characters.");
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, saved: string): Promise<boolean> {
  const [salt, encoded] = saved.split(":");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "hex");
  const actual = await scrypt(password, salt, 64) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createDashboardAuth({ store, secret }: { store: PostgresContentStore; secret: string }) {
  if (secret.length < 32) throw new Error("CMS session secret needs at least 32 characters.");
  const cookieName = `silicon_cms_${store.siteId}`;
  const sign = (payload: string) => createHmac("sha256", secret).update(payload).digest("base64url");
  async function session(): Promise<SiteUserRecord | null> {
    const token = (await cookies()).get(cookieName)?.value;
    if (!token) return null;
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra) return null;
    const actual = Buffer.from(signature, "base64url");
    const expected = Buffer.from(sign(payload), "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    try {
      const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; revision?: number; expires?: number };
      if (!data.userId || !Number.isInteger(data.revision) || !data.expires || data.expires <= Date.now()) return null;
      const user = await store.getUser(data.userId);
      return user?.active && user.revision === data.revision ? user : null;
    } catch { return null; }
  }
  return {
    async login(email: string, password: string): Promise<boolean> {
      const normalized = email.trim().toLowerCase();
      const requestHeaders = await headers();
      const clientAddress = requestHeaders.get("x-real-ip") || requestHeaders.get("x-forwarded-for")?.split(",")[0] || "unknown";
      const identityHash = createHash("sha256").update(`${normalized}:${clientAddress.trim()}`).digest("hex");
      if (!await store.allowLoginAttempt(identityHash)) return false;
      const user = await store.getUserByEmail(normalized);
      if (!user || !user.active || !await verifyPassword(password, user.passwordHash)) return false;
      const payload = Buffer.from(JSON.stringify({ userId: user.userId, revision: user.revision, expires: Date.now() + TTL_SECONDS * 1000 })).toString("base64url");
      (await cookies()).set(cookieName, `${payload}.${sign(payload)}`, {
        httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
        path: "/dashboard", maxAge: TTL_SECONDS,
      });
      return true;
    },
    session,
    async authorize(): Promise<boolean> {
      const user = await session();
      return user !== null && (user.role === "admin" || user.role === "super-admin");
    },
    async logout(): Promise<void> {
      (await cookies()).delete({ name: cookieName, path: "/dashboard" });
    },
  };
}
