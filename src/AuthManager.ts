import type { Page } from "playwright";
import { BrowserSession } from "./BrowserSession.js";
import type { Logger } from "./logger.js";
import { anyVisible, firstVisible } from "./dom.js";
import { NotLoggedInError } from "./errors.js";
import { LOGGED_IN_MARKERS, LOGGED_OUT_MARKERS, LOGIN, URLS } from "./selectors.js";

export interface ManualLoginOptions {
  /** Delai max d'attente de la connexion manuelle (ms). Defaut: 5 min. */
  timeoutMs?: number;
}

/**
 * Gere l'etat d'authentification.
 *
 * Facebook detecte et bloque le remplissage automatique des identifiants : la
 * connexion se fait donc UNIQUEMENT a la main, dans la fenetre du navigateur.
 * La session (cookies) est ensuite sauvegardee et reutilisee. La session est
 * la seule source de verite.
 */
export class AuthManager {
  private readonly log: Logger;
  constructor(private readonly session: BrowserSession) {
    this.log = session.logger;
  }

  /** Navigue vers l'accueil et detecte si la session est deja valide. */
  async isLoggedIn(): Promise<boolean> {
    const page = this.session.page;
    this.log.step("Verification de la session (chargement de facebook.com)...");
    await page.goto(URLS.home, { waitUntil: "domcontentloaded" });
    await this.dismissCookieBanner(page);

    if (await anyVisible(page, LOGGED_IN_MARKERS, 5000)) {
      this.log.info("Session valide : deja connecte.");
      return true;
    }
    if (await anyVisible(page, LOGGED_OUT_MARKERS, 2000)) {
      this.log.info("Non connecte (formulaire de login detecte).");
      return false;
    }
    // Ambigu : on retente une fois les markers loggue.
    const ok = await anyVisible(page, LOGGED_IN_MARKERS, 3000);
    this.log.info(ok ? "Session valide." : "Etat ambigu -> considere non connecte.");
    return ok;
  }

  /**
   * Login 100% MANUEL : ouvre la page de connexion et attend que l'utilisateur
   * se connecte lui-meme dans la fenetre (aucun identifiant tape par la lib).
   * Une fois connecte, sauve la session.
   */
  async waitForManualLogin(opts: ManualLoginOptions = {}): Promise<void> {
    const timeoutMs = opts.timeoutMs ?? 300_000;

    if (await this.isLoggedIn()) {
      this.log.step("Deja connecte — session valide, rien a faire.");
      return;
    }

    const page = this.session.page;
    this.log.step("Ouverture de la page de connexion...");
    await page.goto(URLS.login, { waitUntil: "domcontentloaded" });
    await this.dismissCookieBanner(page);

    process.stdout.write(
      "\n========================================================\n" +
        ">>> CONNECTE-TOI MANUELLEMENT dans la fenetre Chromium.\n" +
        ">>> (email + mot de passe + 2FA/captcha si demande)\n" +
        `>>> J'attends jusqu'a ${Math.round(timeoutMs / 1000)}s...\n` +
        "========================================================\n",
    );

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await firstVisible(page, LOGGED_IN_MARKERS, 1000)) {
        this.log.step("Connexion detectee — sauvegarde de la session.");
        await this.session.saveState();
        return;
      }
      await page.waitForTimeout(1500);
    }
    throw new NotLoggedInError(
      "Login manuel non termine dans le delai imparti. Relance et connecte-toi.",
    );
  }

  private async dismissCookieBanner(page: Page): Promise<void> {
    const btn = await firstVisible(page, LOGIN.cookieAccept, 4000);
    if (!btn) return;
    this.log.info("Bandeau cookies detecte -> acceptation.");
    await btn.click().catch(() => {});
    // Attend que le dialog cookies disparaisse (sinon il intercepte les clics).
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (!(await anyVisible(page, LOGIN.cookieAccept, 500))) return;
      await page.waitForTimeout(250);
    }
  }
}
