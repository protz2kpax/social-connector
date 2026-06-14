import type { Page } from "playwright";
import type { Logger } from "./logger.js";

export type ProviderId = "facebook" | "whatsapp" | "linkedin";

/**
 * Authentication config for a provider. Auth is always manual: we just
 * need to know where to go and how to recognize the logged-in state.
 */
export interface ProviderAuthConfig {
  /** Home page (logged-in state expected). */
  homeUrl: string;
  /** Login page (or QR for WhatsApp). */
  loginUrl: string;
  /** Selectors present ONLY when logged in. */
  loggedInMarkers: readonly string[];
  /** Selectors present ONLY when logged out. */
  loggedOutMarkers: readonly string[];
  /**
   * Max wait (ms) for loggedInMarkers when probing session validity.
   * Bump for slow-loading providers (e.g. WhatsApp Web). Default: 5000.
   */
  loggedInTimeoutMs?: number;
  /** Cookie accept button, if the provider shows one. */
  cookieAccept?: readonly string[];
}

export interface PostOptions {
  /**
   * Recipient phone number. WhatsApp only: international number, no '+'
   * (e.g. "33612345678"). Ignored by wall/feed providers (Facebook, LinkedIn).
   */
  target?: string;
  /**
   * Chat/group/community name to open by searching the WhatsApp chat list.
   * Use this to message a group or a community's announcement group, which
   * have no phone number. Takes precedence over `target`. EXPERIMENTAL:
   * matches by visible name, so the name must be unique enough.
   */
  chat?: string;
  /** Screenshot before send/post (path). Debug. */
  screenshotPath?: string;
}

/** Context passed to a provider's post() action. */
export interface PostContext {
  page: Page;
  content: string;
  options: PostOptions;
  log: Logger;
}

/** One post authored by the logged-in user, as scraped from their profile. */
export interface Post {
  /** Text content of the post. */
  text: string;
  /** Permalink to the post, if found. */
  url?: string;
  /** Relative time/age as shown in the UI (e.g. "2d"), if found. */
  time?: string;
}

export interface ReadOptions {
  /** Max number of posts to return. Default: 10. */
  limit?: number;
}

/** Context passed to a provider's readPosts() action. */
export interface ReadContext {
  page: Page;
  options: ReadOptions;
  log: Logger;
}

/** A provider = auth config + a specific posting action. */
export interface SocialProvider {
  id: ProviderId;
  /** Human-readable name (logs, CLI). */
  label: string;
  /** Default persistent profile directory. */
  defaultUserDataDir: string;
  auth: ProviderAuthConfig;
  /** Posting / sending action, specific to the provider. */
  post(ctx: PostContext): Promise<void>;
  /**
   * Reads the logged-in user's own posts. Optional: providers that have no
   * concept of a post feed (e.g. WhatsApp) omit it.
   */
  readPosts?(ctx: ReadContext): Promise<Post[]>;
}
