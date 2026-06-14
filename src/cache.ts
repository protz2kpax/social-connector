import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConversationMessage } from "./types.js";

/**
 * Optional encrypted local cache of conversations. Opt-in: active only when
 * CACHE_PASSPHRASE is set. One AES-256-GCM file per chat under ./.cache.
 *
 * NOTE: the persistent browser profile (.wa-profile) already stores all
 * WhatsApp messages in cleartext on disk. This cache encrypts the EXPORTED
 * copy only; it does not protect the source profile.
 */

const DIR = process.env.CACHE_DIR ?? "./.cache";
const MAX_MESSAGES = 2000;

export function cacheEnabled(): boolean {
  return Boolean(process.env.CACHE_PASSPHRASE);
}

function passphrase(): string {
  const p = process.env.CACHE_PASSPHRASE;
  if (!p) throw new Error("CACHE_PASSPHRASE not set");
  return p;
}

function fileFor(chat: string): string {
  const h = createHash("sha256").update(chat).digest("hex").slice(0, 32);
  return join(DIR, `${h}.enc`);
}

/** [salt(16) | iv(12) | tag(16) | ciphertext]. */
function encrypt(plain: string): Buffer {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase(), salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([salt, iv, cipher.getAuthTag(), ct]);
}

function decrypt(buf: Buffer): string {
  const salt = buf.subarray(0, 16);
  const iv = buf.subarray(16, 28);
  const tag = buf.subarray(28, 44);
  const key = scryptSync(passphrase(), salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(buf.subarray(44)), decipher.final()]).toString("utf8");
}

export interface CacheEntry {
  chat: string;
  updatedAt: string;
  messages: ConversationMessage[];
}

/** Reads & decrypts a chat's cache, or null if absent / wrong passphrase. */
export async function readCache(chat: string): Promise<CacheEntry | null> {
  if (!cacheEnabled()) return null;
  const f = fileFor(chat);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(decrypt(await readFile(f))) as CacheEntry;
  } catch {
    return null; // corrupt or wrong passphrase
  }
}

function msgKey(m: ConversationMessage): string {
  return m.id ?? `${m.date ?? ""}|${m.time ?? ""}|${m.from}|${m.text}`;
}

/** Merges fresh messages into the chat's cache (dedup) and re-encrypts. */
export async function writeCache(
  chat: string,
  fresh: ConversationMessage[],
  nowIso: string,
): Promise<void> {
  if (!cacheEnabled()) return;
  await mkdir(DIR, { recursive: true }).catch(() => {});
  const prev = (await readCache(chat))?.messages ?? [];
  const seen = new Set(prev.map(msgKey));
  const merged = [...prev];
  for (const m of fresh) {
    const k = msgKey(m);
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(m);
    }
  }
  const entry: CacheEntry = {
    chat,
    updatedAt: nowIso,
    messages: merged.slice(-MAX_MESSAGES),
  };
  await writeFile(fileFor(chat), encrypt(JSON.stringify(entry)), { mode: 0o600 });
}

/** True if the entry is younger than maxAgeMs (0 disables cache serving). */
export function isFresh(entry: CacheEntry, maxAgeMs: number, nowMs: number): boolean {
  if (maxAgeMs <= 0) return false;
  const t = Date.parse(entry.updatedAt);
  return !Number.isNaN(t) && nowMs - t <= maxAgeMs;
}
