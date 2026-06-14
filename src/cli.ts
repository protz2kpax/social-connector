#!/usr/bin/env node
import { existsSync } from "node:fs";
import { FacebookConnector } from "./FacebookConnector.js";
import { FacebookConnectorError } from "./errors.js";

/**
 * CLI minimale. La connexion est TOUJOURS manuelle (Facebook bloque le login
 * automatise) : une fenetre s'ouvre, tu te connectes a la main, la session est
 * sauvegardee puis reutilisee.
 *
 *   facebook-connector login                 # ouvre la fenetre, connexion manuelle
 *   facebook-connector post "Mon message"    # publie sur le mur (session requise)
 *   facebook-connector status                # dit si une session valide existe
 */

// Charge .env si present (Node >= 20.6).
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

function makeConnector(forceHeaded = false): FacebookConnector {
  return new FacebookConnector({
    statePath: process.env.FB_STATE_PATH ?? "./fb-state.json",
    headless: forceHeaded ? false : bool(process.env.FB_HEADLESS, false),
  });
}

async function main(): Promise<void> {
  loadEnv();
  const [cmd, ...rest] = process.argv.slice(2);

  switch (cmd) {
    case "login": {
      // Login manuel -> fenetre visible forcee.
      const fb = makeConnector(true);
      try {
        await fb.login();
        console.log("[OK] Connecte. Session sauvegardee.");
      } finally {
        await fb.close();
      }
      break;
    }

    case "post": {
      const text = rest.join(" ").trim();
      if (!text) {
        console.error('Usage: facebook-connector post "ton message"');
        process.exit(1);
      }
      const fb = makeConnector();
      try {
        if (!(await fb.isLoggedIn())) {
          console.error(
            "[ERREUR] Pas de session valide. Lance d'abord:  npm run login",
          );
          process.exit(1);
        }
        await fb.postToWall(text);
        console.log("[OK] Publie sur le mur.");
      } finally {
        await fb.close();
      }
      break;
    }

    case "status": {
      const fb = makeConnector();
      try {
        const ok = await fb.isLoggedIn();
        console.log(ok ? "[OK] Session valide." : "[--] Pas de session valide.");
      } finally {
        await fb.close();
      }
      break;
    }

    default:
      console.log(
        [
          "facebook-connector — publie sur ton mur Facebook.",
          "",
          "Commandes:",
          "  login                  Ouvre une fenetre, tu te connectes a la main, sauve la session",
          '  post "message"         Publie un message sur le mur (session requise)',
          "  status                 Indique si une session valide existe",
          "",
          "Config (.env): FB_STATE_PATH, FB_HEADLESS (0=visible, 1=headless)",
        ].join("\n"),
      );
      if (cmd && cmd !== "help") process.exit(1);
  }
}

main().catch((err) => {
  if (err instanceof FacebookConnectorError) {
    console.error(`[ERREUR] ${err.name}: ${err.message}`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
