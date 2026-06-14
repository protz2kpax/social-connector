import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { NOOP_LOGGER, type Logger } from "./logger.js";

export interface BrowserSessionOptions {
  /**
   * Directory of the persistent browser profile. Unlike a storageState
   * file, this keeps the FULL profile on disk: cookies, localStorage,
   * IndexedDB, cache and service workers. Lets slow providers (WhatsApp
   * Web) reuse their cached chats instead of re-syncing on every launch.
   */
  userDataDir: string;
  /** Headless browser. Default: true (hidden). */
  headless?: boolean;
  /** Slows down each action (ms) — useful for visual debugging. */
  slowMo?: number;
  /** Browser locale. Default: fr-FR. */
  locale?: string;
  /** Progress logger. Default: silent. */
  logger?: Logger;
}

/**
 * Manages the Playwright lifecycle and session persistence.
 *
 * Uses a persistent context (a real on-disk browser profile) so the whole
 * session — including IndexedDB and cache — survives between runs. Single
 * responsibility: open the browser on that profile and expose a Page.
 */
export class BrowserSession {
  private context?: BrowserContext;
  private pageInstance?: Page;
  private readonly log: Logger;

  constructor(private readonly opts: BrowserSessionOptions) {
    this.log = opts.logger ?? NOOP_LOGGER;
  }

  /** Launches the browser on the persistent profile and returns its page. */
  async start(): Promise<Page> {
    if (this.pageInstance) return this.pageInstance;

    await mkdir(this.opts.userDataDir, { recursive: true }).catch(() => {});
    this.log.step(
      `Launching the browser (headless=${this.opts.headless ?? false})...`,
    );
    this.context = await chromium.launchPersistentContext(this.opts.userDataDir, {
      headless: this.opts.headless ?? false,
      slowMo: this.opts.slowMo,
      locale: this.opts.locale ?? "fr-FR",
      // Realistic user-agent to reduce bot detection.
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });
    this.log.info(`Persistent profile: ${this.opts.userDataDir}`);

    this.pageInstance = this.context.pages()[0] ?? (await this.context.newPage());
    this.log.info("Browser ready.");
    return this.pageInstance;
  }

  get logger(): Logger {
    return this.log;
  }

  get page(): Page {
    if (!this.pageInstance) {
      throw new Error("BrowserSession not started — call start() first.");
    }
    return this.pageInstance;
  }

  /**
   * No-op flush: a persistent context writes its state to disk continuously,
   * so there is nothing extra to save. Kept for API compatibility.
   */
  async saveState(): Promise<void> {
    this.log.info(`Session persisted in ${this.opts.userDataDir}`);
  }

  /** Cleanly closes the browser (flushes the profile to disk). */
  async close(): Promise<void> {
    await this.context?.close().catch(() => {});
    this.pageInstance = undefined;
    this.context = undefined;
  }
}
