import type { Page } from "playwright";
import { firstVisible, requireVisible, waitGone } from "../dom.js";
import { PostFailedError, SelectorError } from "../errors.js";
import type { Logger } from "../logger.js";
import type { SocialProvider } from "../types.js";

/**
 * WhatsApp Web — sends a message to a contact, a group, or a community's
 * announcement group.
 *
 * Login = scan the QR code (manual, like the others: no auto-typing).
 *
 * Two ways to pick the destination:
 *   - options.target = international number WITHOUT '+' (e.g. "33612345678").
 *     A contact has a phone number, so we open it via `send?phone=...`.
 *   - options.chat = a chat/group/community name. Groups and communities have
 *     no phone number, so we open them by typing the name in the search box
 *     and clicking the matching result. EXPERIMENTAL: matched by visible name.
 *
 * In both cases the message is then typed and sent.
 *
 * Selectors NOT verified without a real login: patch at the first SelectorError.
 */

const MESSAGE_BOX = [
  'footer div[contenteditable="true"][role="textbox"]',
  'div[aria-label="Saisissez un message"][contenteditable="true"]',
  'div[aria-label="Type a message"][contenteditable="true"]',
  'footer div[contenteditable="true"]',
];

const SEND_BUTTON = [
  'button[aria-label="Envoyer"]',
  'button[aria-label="Send"]',
  'span[data-icon="send"]',
];

const SEARCH_BOX = [
  // WhatsApp Web now uses a plain <input> for the chat search.
  'input[aria-label*="Recherch"]',
  'input[aria-label*="Search"]',
  'input[placeholder*="Recherch"]',
  'input[placeholder*="Search"]',
  'input[data-tab="3"]',
  // Fallbacks for the older contenteditable search box.
  'div[contenteditable="true"][data-tab="3"]',
  '[aria-label="Search input textbox"]',
];

const INVALID_NUMBER_DIALOG = [
  'div[role="dialog"]:has-text("invalide")',
  'div[role="dialog"]:has-text("invalid")',
  'div[role="dialog"]:has-text("URL invalide")',
];

/** Opens a contact's chat via the phone deep-link. */
async function openByPhone(page: Page, phone: string, log: Logger): Promise<void> {
  log.step(`Opening the chat with ${phone}...`);
  await page.goto(`https://web.whatsapp.com/send?phone=${phone}`, {
    waitUntil: "domcontentloaded",
  });
  if (await firstVisible(page, INVALID_NUMBER_DIALOG, 4000)) {
    throw new PostFailedError(
      `WhatsApp: number ${phone} is invalid or not registered on WhatsApp.`,
    );
  }
}

/** Opens a group/community/chat by searching the chat list for its name. */
async function openByName(page: Page, name: string, log: Logger): Promise<void> {
  log.step(`Searching for chat "${name}"...`);
  await page.goto("https://web.whatsapp.com/", { waitUntil: "domcontentloaded" });

  const search = await requireVisible(page, SEARCH_BOX, "WhatsApp search box", 35000);
  await search.click();
  await search.fill("");
  await search.fill(name);
  await page.waitForTimeout(1500);

  // Click the result whose visible title matches the name exactly.
  const result = page.locator("#pane-side").getByTitle(name, { exact: true }).first();
  try {
    await result.waitFor({ state: "visible", timeout: 10000 });
  } catch {
    throw new SelectorError(
      `WhatsApp: no chat titled "${name}" found in the results. ` +
        "Check the exact name (case/accents), or it may not be in your list.",
    );
  }
  await result.click();
}

export const whatsapp: SocialProvider = {
  id: "whatsapp",
  label: "WhatsApp",
  defaultUserDataDir: "./.wa-profile",
  auth: {
    homeUrl: "https://web.whatsapp.com/",
    loginUrl: "https://web.whatsapp.com/",
    // WhatsApp Web can take 10-30s to hydrate the chat list after load.
    loggedInTimeoutMs: 35000,
    loggedInMarkers: [
      "#pane-side",
      'div[aria-label="Liste des discussions"]',
      'div[aria-label="Chat list"]',
      'header[data-testid="chatlist-header"]',
      '[data-icon="new-chat-outline"]',
      '[data-icon="chats"]',
      '[data-icon="chats-filled"]',
      'div[title="Nouvelle discussion"]',
      'div[contenteditable="true"][data-tab="3"]',
      "#side",
    ],
    loggedOutMarkers: [
      'canvas[aria-label*="Scan"]',
      'canvas[aria-label*="scan"]',
      "div[data-ref]",
      '[data-icon="intro-md-beta-logo-dark"]',
      '[aria-label*="QR"]',
      'div:has-text("to log in")',
      'div:has-text("Log in")',
    ],
    // WhatsApp Web does not show a cookie banner.
  },

  async post({ page, content, options, log }) {
    // `chat` (group/community by name) takes precedence over `target` (phone).
    if (options.chat?.trim()) {
      await openByName(page, options.chat.trim(), log);
    } else {
      const phone = (options.target ?? "").replace(/[^0-9]/g, "");
      if (!phone) {
        throw new PostFailedError(
          "WhatsApp: provide --to <number> (contact) or --chat <name> (group/community).",
        );
      }
      await openByPhone(page, phone, log);
    }

    log.step("Waiting for the message box...");
    const box = await requireVisible(page, MESSAGE_BOX, "WhatsApp message box", 30000);
    await box.click();

    log.step("Typing the message...");
    await box.type(content, { delay: 10 });

    if (options.screenshotPath) {
      await page.screenshot({ path: options.screenshotPath }).catch(() => {});
      log.info(`Screenshot: ${options.screenshotPath}`);
    }

    log.step("Sending the message...");
    const send = await firstVisible(page, SEND_BUTTON, 4000);
    if (send) await send.click();
    else await page.keyboard.press("Enter");

    // Best-effort confirmation: the send button disappears once sent.
    await waitGone(page, SEND_BUTTON, 8000);
    log.step("Message sent.");
  },
};
