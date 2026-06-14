#!/usr/bin/env node
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { SocialConnector } from "./SocialConnector.js";
import { SocialConnectorError } from "./errors.js";
import { PROVIDERS } from "./providers/index.js";
import type { ProviderId } from "./types.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };
const BIN = "social-connector";
const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

/**
 * Multi-provider CLI. Login is ALWAYS manual (visible window).
 *
 *   social-connector login  whatsapp                       # scan QR
 *   social-connector post    facebook "Hello wall"
 *   social-connector post    whatsapp --to 33612345678 "Hi"
 *   social-connector status  linkedin
 *
 * The provider can be given as the first argument or via --provider.
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

interface Args {
  provider?: string;
  to?: string;
  screenshot?: string;
  show?: boolean;
  help?: boolean;
  positionals: string[];
}

/** Extracts --flag/-f values and returns {flags, positionals}. */
function parseArgs(argv: string[]): Args {
  const out: Args = { positionals: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--provider" || a === "-p") out.provider = argv[++i];
    else if (a === "--to" || a === "-t") out.to = argv[++i];
    else if (a === "--screenshot") out.screenshot = argv[++i];
    else if (a === "--show" || a === "--headed" || a === "-s") out.show = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else out.positionals.push(a!);
  }
  return out;
}

/**
 * Resolves the provider from --provider, or the first positional argument
 * if it names a known provider (then consumes it), or the PROVIDER env var.
 */
function takeProvider(args: Args): ProviderId {
  let id = args.provider;
  if (!id && args.positionals[0] && args.positionals[0] in PROVIDERS) {
    id = args.positionals.shift();
  }
  id = id ?? process.env.PROVIDER;
  if (!id) {
    throw new SocialConnectorError(
      `Provider required: pass it as the first argument or --provider <${PROVIDER_IDS.join("|")}>`,
    );
  }
  if (!(id in PROVIDERS)) {
    throw new SocialConnectorError(
      `Unknown provider "${id}". Available: ${PROVIDER_IDS.join(", ")}.`,
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

function generalHelp(): string {
  return [
    `${pkg.name} v${pkg.version} — post/send on several networks (manual login).`,
    "",
    `Usage: ${BIN} <command> [provider] [options]`,
    "",
    `Providers: ${PROVIDER_IDS.join(", ")}`,
    "",
    "Commands:",
    "  login   [provider]                     Open a window, log in by hand (or scan QR), save the session",
    '  post    [provider] [--to <num>] "msg"  Post (Facebook/LinkedIn) or send (WhatsApp, needs --to)',
    "  status  [provider]                     Print whether a valid session exists",
    "  help                                   Show this help",
    "",
    "Options:",
    "  -p, --provider <id>   Provider (else first arg, else PROVIDER env)",
    "  -t, --to <num>        WhatsApp recipient: international number, no '+' (e.g. 33612345678)",
    "  -s, --show, --headed  Show Chromium for this run (default: hidden). login is always visible.",
    "      --screenshot <p>  Save a screenshot before sending (debug)",
    "  -h, --help            Show help (use after a command for command help)",
    "  -v, --version         Print version",
    "",
    "Env (.env): USER_DATA_DIR, HEADLESS (1=hidden default, 0=visible), PROVIDER (default)",
    "",
    "Examples:",
    `  ${BIN} login whatsapp`,
    `  ${BIN} post facebook "Hello wall"`,
    `  ${BIN} post whatsapp --to 33612345678 "Hi!" --show`,
    `  ${BIN} status linkedin`,
  ].join("\n");
}

function commandHelp(cmd: string): string {
  switch (cmd) {
    case "login":
      return [
        `Usage: ${BIN} login [provider]`,
        "",
        "Open a visible window and wait for you to log in by hand (or scan the QR",
        "for WhatsApp), then persist the session. Always visible, even with HEADLESS=1.",
        "",
        `Example: ${BIN} login whatsapp`,
      ].join("\n");
    case "post":
      return [
        `Usage: ${BIN} post [provider] [--to <num>] [--show] "your message"`,
        "",
        "Post to the wall/feed (Facebook, LinkedIn) or send a message (WhatsApp).",
        "WhatsApp requires --to <international number without '+'>.",
        "",
        "Options: -t/--to, -s/--show, --screenshot <path>",
        "",
        `Examples:`,
        `  ${BIN} post linkedin "Hello feed"`,
        `  ${BIN} post whatsapp --to 33612345678 "Hi!"`,
      ].join("\n");
    case "status":
      return [
        `Usage: ${BIN} status [provider]`,
        "",
        "Print whether a valid saved session exists for the provider.",
        "",
        `Example: ${BIN} status facebook`,
      ].join("\n");
    default:
      return generalHelp();
  }
}

async function main(): Promise<void> {
  loadEnv();
  const [cmd, ...rest] = process.argv.slice(2);

  if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
    console.log(generalHelp());
    return;
  }
  if (cmd === "-v" || cmd === "--version") {
    console.log(pkg.version);
    return;
  }

  const args = parseArgs(rest);
  if (args.help) {
    console.log(commandHelp(cmd));
    return;
  }

  switch (cmd) {
    case "login": {
      const fb = makeConnector(takeProvider(args), { forceVisible: true });
      try {
        await fb.login();
        console.log("[OK] Logged in. Session saved.");
      } finally {
        await fb.close();
      }
      break;
    }

    case "post": {
      const provider = takeProvider(args);
      const text = args.positionals.join(" ").trim();
      if (!text) {
        console.error(`Usage: ${BIN} post [provider] [--to <num>] "your message"`);
        process.exit(1);
      }
      const fb = makeConnector(provider, { show: args.show });
      try {
        if (!(await fb.isLoggedIn())) {
          console.error(
            `[ERROR] No ${provider} session. Run first:  ${BIN} login ${provider}`,
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
      const fb = makeConnector(takeProvider(args), { show: args.show });
      try {
        const ok = await fb.isLoggedIn();
        console.log(ok ? "[OK] Valid session." : "[--] No valid session.");
      } finally {
        await fb.close();
      }
      break;
    }

    default:
      console.error(`Unknown command "${cmd}".\n`);
      console.log(generalHelp());
      process.exit(1);
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
