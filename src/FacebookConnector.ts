import { BrowserSession } from "./BrowserSession.js";
import { AuthManager, type ManualLoginOptions } from "./AuthManager.js";
import { WallPoster, type PostOptions } from "./WallPoster.js";
import { NotLoggedInError } from "./errors.js";
import { createLogger } from "./logger.js";

export interface FacebookConnectorOptions {
  /** Chemin du fichier de session sauvegardee. Defaut: ./fb-state.json */
  statePath?: string;
  /** Navigateur sans interface. Defaut: false (visible). */
  headless?: boolean;
  /** Ralentit les actions (ms) pour debug visuel. */
  slowMo?: number;
  /** Locale du navigateur. Defaut: fr-FR. */
  locale?: string;
  /** Affiche les logs de progression (etapes + temps). Defaut: true. */
  verbose?: boolean;
}

/**
 * Facade publique de la librairie.
 *
 *   const fb = new FacebookConnector();
 *   await fb.login();                 // login MANUEL dans la fenetre, 1 fois
 *   await fb.postToWall("Mon message");
 *   await fb.close();
 *
 * La connexion est toujours manuelle (Facebook bloque le login automatise).
 * Une fois connecte, la session est sauvee et reutilisee : les appels suivants
 * a login() ne font rien si la session est encore valide.
 */
export class FacebookConnector {
  private readonly session: BrowserSession;
  private readonly auth: AuthManager;
  private readonly poster: WallPoster;
  private started = false;

  constructor(opts: FacebookConnectorOptions = {}) {
    const logger = createLogger(opts.verbose ?? true);
    this.session = new BrowserSession({
      statePath: opts.statePath ?? "./fb-state.json",
      headless: opts.headless ?? false,
      slowMo: opts.slowMo,
      locale: opts.locale,
      logger,
    });
    this.auth = new AuthManager(this.session);
    this.poster = new WallPoster(this.session);
  }

  /** Demarre le navigateur (idempotent). Appele automatiquement par login/post. */
  async start(): Promise<void> {
    if (this.started) return;
    await this.session.start();
    this.started = true;
  }

  /**
   * Connexion MANUELLE : reutilise la session sauvee si valide, sinon ouvre la
   * fenetre et attend que tu te connectes a la main, puis sauve la session.
   * Necessite headless=false (fenetre visible).
   */
  async login(opts?: ManualLoginOptions): Promise<void> {
    await this.start();
    await this.auth.waitForManualLogin(opts);
  }

  /** Verifie une session deja sauvegardee. */
  async isLoggedIn(): Promise<boolean> {
    await this.start();
    return this.auth.isLoggedIn();
  }

  /** Publie un texte sur le mur. Requiert une session valide (login prealable). */
  async postToWall(text: string, opts?: PostOptions): Promise<void> {
    await this.start();
    if (!(await this.auth.isLoggedIn())) {
      throw new NotLoggedInError(
        "Pas de session valide. Lance d'abord la connexion manuelle (fb.login()).",
      );
    }
    await this.poster.post(text, opts);
  }

  /** Ferme le navigateur. A appeler en fin d'utilisation. */
  async close(): Promise<void> {
    await this.session.close();
    this.started = false;
  }
}
