#!/usr/bin/env node
import { existsSync } from "node:fs";
import { SocialConnector } from "./SocialConnector.js";
import { SocialConnectorError } from "./errors.js";
import { PROVIDERS } from "./providers/index.js";
import type { ProviderId } from "./types.js";

/**
 * Multi-provider CLI. Login is ALWAYS manual (visible window).
 *
 *   social-connector login   --provider facebook
 *   social-connector login   --provider whatsapp           # scan QR
 *   social-connector post    --provider facebook "Hello wall"
 *   social-connector post    --provider whatsapp --to 33612345678 "Hi"
 *   social-connector status  --provider linkedin
 */

function loadEnv(): void {
  if (existsSync(".env") && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(".env");
    } catch {
      /* ignore */
    }
  }
}

function bool(v: string | undefined, def: boolean): boolean {
  if (v === undefined) return def;
  return v === "1" || v.toLowerCase() === "true";
}

/** Extracts --flag/-f values and returns {flags, positionals}. */
function parseArgs(argv: string[]): {
  provider?: string;
  to?: string;
  screenshot?: string;
  show?: boolean;
  positionals: string[];
} {
  const out: {
    provider?: string;
    to?: string;
    screenshot?: string;
    show?: boolean;
    positionals: string[];
  } = {
    positionals: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--provider" || a === "-p") out.provider = argv[++i];
    else if (a === "--to" || a === "-t") out.to = argv[++i];
    else if (a === "--screenshot") out.screenshot = argv[++i];
    else if (a === "--show" || a === "--headed" || a === "-s") out.show = true;
    else out.positionals.push(a!);
  }
  return out;
}

function resolveProvider(flag?: string): ProviderId {
  const id = flag ?? process.env.PROVIDER;
  if (!id) {
    throw new SocialConnectorError(
      `Provider required: --provider <${Object.keys(PROVIDERS).join("|")}>`,
    );
  }
  if (!(id in PROVIDERS)) {
    throw new SocialConnectorError(
      `Unknown provider "${id}". Available: ${Object.keys(PROVIDERS).join(", ")}.`,
    );
  }
  return id as ProviderId;
}

/**
 * Resolve headless: hidden by default. A visible window is forced when
 * `--show` is passed, when the caller requires it (login/QR), or when
 * HEADLESS=0 is set in the env.
 */
function makeConnector(
  provider: ProviderId,
  { forceVisible = false, show = false }: { forceVisible?: boolean; show?: boolean } = {},
): SocialConnector {
  const visible = forceVisible || show || !bool(process.env.HEADLESS, true);
  return new SocialConnector(provider, {
    userDataDir: process.env.USER_DATA_DIR,
    headless: !visible,
  });
}

async function main(): Promise<void> {
  loadEnv();
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  switch (cmd) {
    case "login": {
      const fb = makeConnector(resolveProvider(args.provider), { forceVisible: true });
      try {
        await fb.login();
        console.log("[OK] Logged in. Session saved.");
      } finally {
        await fb.close();
      }
      break;
    }

    case "post": {
      const provider = resolveProvider(args.provider);
      const text = args.positionals.join(" ").trim();
      if (!text) {
        console.error('Usage: post --provider <id> [--to <num>] "your message"');
        process.exit(1);
      }
      const fb = makeConnector(provider, { show: args.show });
      try {
        if (!(await fb.isLoggedIn())) {
          console.error(
            `[ERROR] No ${provider} session. Run first:  login --provider ${provider}`,
          );
          process.exit(1);
        }
        await fb.post(text, { target: args.to, screenshotPath: args.screenshot });
        console.log("[OK] Message posted/sent.");
      } finally {
        await fb.close();
      }
      break;
    }

    case "status": {
      const fb = makeConnector(resolveProvider(args.provider), { show: args.show });
      try {
        const ok = await fb.isLoggedIn();
        console.log(ok ? "[OK] Valid session." : "[--] No valid session.");
      } finally {
        await fb.close();
      }
      break;
    }

    default:
      console.log(
        [
          "social-connector — post/send on several networks (manual login).",
          "",
          `Providers: ${Object.keys(PROVIDERS).join(", ")}`,
          "",
          "Commands:",
          "  login  --provider <id>                 Open a window, manual login, save the session",
          '  post   --provider <id> [--to <num>] "msg"   Post (FB/LinkedIn) or send (WhatsApp --to)',
          "  status --provider <id>                 Indicates whether a valid session exists",
          "",
          "Flags:",
          "  --show, --headed, -s                   Show Chromium (default: hidden). login is always visible.",
          "",
          "Config (.env): USER_DATA_DIR, HEADLESS (1=hidden default, 0=visible), PROVIDER (default)",
        ].join("\n"),
      );
      if (cmd && cmd !== "help") process.exit(1);
  }
}

main().catch((err) => {
  if (err instanceof SocialConnectorError) {
    console.error(`[ERROR] ${err.name}: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
