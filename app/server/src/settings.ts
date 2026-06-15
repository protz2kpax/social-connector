import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Local settings store for API keys entered in the app (Settings screen).
 * Persisted to ~/.relay/settings.json (outside the repo, mode 600) and applied
 * to process.env so the library's runAi picks them up. Env vars / .env still
 * work as a fallback and are reflected in the masked view.
 */

const DIR = process.env.RELAY_DATA_DIR ?? join(homedir(), ".relay");
const FILE = join(DIR, "settings.json");

export interface Settings {
  aiProvider?: "openai" | "anthropic";
  openaiKey?: string;
  anthropicKey?: string;
}

let current: Settings = {};

export async function loadSettings(): Promise<void> {
  if (!existsSync(FILE)) return;
  try {
    current = JSON.parse(await readFile(FILE, "utf8")) as Settings;
  } catch {
    current = {};
  }
  applyToEnv();
}

/** Pushes stored keys into process.env so per-request AI clients use them. */
export function applyToEnv(): void {
  if (current.openaiKey) process.env.OPENAI_API_KEY = current.openaiKey;
  if (current.anthropicKey) process.env.ANTHROPIC_API_KEY = current.anthropicKey;
  if (current.aiProvider) process.env.AI_PROVIDER = current.aiProvider;
}

/**
 * Merges a patch and persists. For key fields: a non-empty string sets it, an
 * empty string clears it, `undefined` leaves it unchanged.
 */
export async function saveSettings(patch: Settings): Promise<void> {
  const next: Settings = { ...current };
  if (patch.aiProvider !== undefined) next.aiProvider = patch.aiProvider;
  if (patch.openaiKey !== undefined) next.openaiKey = patch.openaiKey || undefined;
  if (patch.anthropicKey !== undefined) next.anthropicKey = patch.anthropicKey || undefined;
  current = next;
  await mkdir(DIR, { recursive: true }).catch(() => {});
  await writeFile(FILE, JSON.stringify(current, null, 2), { mode: 0o600 });
  applyToEnv();
}

function mask(k?: string): string | null {
  return k && k.length >= 4 ? `••••${k.slice(-4)}` : k ? "••••" : null;
}

/** Safe view for the UI: provider + masked key hints, never the raw secrets. */
export function maskedSettings() {
  return {
    aiProvider: current.aiProvider ?? (process.env.AI_PROVIDER as Settings["aiProvider"]) ?? null,
    openai: mask(current.openaiKey ?? process.env.OPENAI_API_KEY),
    anthropic: mask(current.anthropicKey ?? process.env.ANTHROPIC_API_KEY),
  };
}
