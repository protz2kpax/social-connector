import { firstVisible, requireVisible, waitGone } from "../dom.js";
import { PostFailedError } from "../errors.js";
import type { SocialProvider } from "../types.js";

/**
 * WhatsApp Web — sends a message to a contact.
 *
 * Login = scan the QR code (manual, like the others: no auto-typing).
 * The action requires options.target = international number WITHOUT '+' or
 * spaces (e.g. "33612345678"). We open the URL `send?phone=...&text=...`
 * which pre-fills the message, then we send it.
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

const INVALID_NUMBER_DIALOG = [
  'div[role="dialog"]:has-text("invalide")',
  'div[role="dialog"]:has-text("invalid")',
  'div[role="dialog"]:has-text("URL invalide")',
];

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
    const phone = (options.target ?? "").replace(/[^0-9]/g, "");
    if (!phone) {
      throw new PostFailedError(
        "WhatsApp: 'target' required (international number without '+', e.g. 33612345678).",
      );
    }

    log.step(`Opening the chat with ${phone}...`);
    const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(content)}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });

    // Invalid / unregistered number?
    if (await firstVisible(page, INVALID_NUMBER_DIALOG, 4000)) {
      throw new PostFailedError(
        `WhatsApp: number ${phone} is invalid or not registered on WhatsApp.`,
      );
    }

    log.step("Waiting for the message box...");
    const box = await requireVisible(page, MESSAGE_BOX, "WhatsApp message box", 30000);
    await box.click();

    if (options.screenshotPath) {
      await page.screenshot({ path: options.screenshotPath }).catch(() => {});
      log.info(`Screenshot: ${options.screenshotPath}`);
    }

    log.step("Sending the message...");
    // The text is already pre-filled via the URL. We send (button, else Enter).
    const send = await firstVisible(page, SEND_BUTTON, 4000);
    if (send) await send.click();
    else await page.keyboard.press("Enter");

    // Best-effort confirmation: the message box clears after sending.
    await waitGone(page, SEND_BUTTON, 8000);
    log.step("Message sent.");
  },
};
