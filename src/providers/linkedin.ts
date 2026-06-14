import { collectPosts, firstVisible, requireVisible, waitGone } from "../dom.js";
import { PostFailedError } from "../errors.js";
import type { SocialProvider } from "../types.js";

/** Selectors for the link to the logged-in user's own profile (/in/<vanity>). */
const OWN_PROFILE_LINK = [
  'a[href*="/in/"][data-control-name="identity_profile_photo"]',
  ".global-nav__me a[href*=\"/in/\"]",
  'aside a[href*="/in/"]',
  'a.profile-card-profile-link[href*="/in/"]',
  'a[href*="/in/"]',
];

/**
 * LinkedIn — posts text to the feed.
 * FR + EN selectors, tolerant. NOT verified without a real login: patch at
 * the first SelectorError.
 */

const COMPOSER_TRIGGER = [
  'button:has-text("Commencer un post")',
  'button:has-text("Start a post")',
  ".share-box-feed-entry__trigger",
  'button[aria-label*="Commencer un post"]',
  'button[aria-label*="Start a post"]',
];

const COMPOSER_INPUT = [
  'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
  "div[role=\"dialog\"] .ql-editor[contenteditable=\"true\"]",
  'div.ql-editor[contenteditable="true"]',
];

const PUBLISH_BUTTON = [
  'div[role="dialog"] button.share-actions__primary-action',
  'div[role="dialog"] button:has-text("Publier")',
  'div[role="dialog"] button:has-text("Post")',
];

export const linkedin: SocialProvider = {
  id: "linkedin",
  label: "LinkedIn",
  defaultUserDataDir: "./.li-profile",
  auth: {
    homeUrl: "https://www.linkedin.com/feed/",
    loginUrl: "https://www.linkedin.com/login",
    loggedInMarkers: [
      ".share-box-feed-entry__trigger",
      'button[aria-label*="Commencer un post"]',
      'button[aria-label*="Start a post"]',
      "#global-nav",
      'header[role="banner"] input[role="combobox"]',
    ],
    loggedOutMarkers: [
      "input#username",
      'input[name="session_key"]',
      "form.login__form",
      'a[href*="/login"]',
    ],
    cookieAccept: [
      'button[action-type="ACCEPT"]',
      'button[aria-label="Accepter"]',
      'button:has-text("Accepter")',
      'button:has-text("Accept")',
    ],
  },

  async post({ page, content, options, log }) {
    log.step("Loading the LinkedIn feed...");
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });

    log.step("Opening the composer (Start a post)...");
    const trigger = await requireVisible(page, COMPOSER_TRIGGER, "LinkedIn composer", 12000);
    await trigger.click();
    const input = await requireVisible(page, COMPOSER_INPUT, "LinkedIn editor", 10000);

    log.step("Typing the text...");
    await input.click();
    await input.type(content, { delay: 15 });

    if (options.screenshotPath) {
      await page.screenshot({ path: options.screenshotPath }).catch(() => {});
      log.info(`Screenshot: ${options.screenshotPath}`);
    }

    log.step("Clicking Publish...");
    const publish = await requireVisible(page, PUBLISH_BUTTON, "LinkedIn Publish button");
    await publish.click();

    if (!(await waitGone(page, PUBLISH_BUTTON, 20000))) {
      throw new PostFailedError(
        "LinkedIn post not confirmed (modal stayed open).",
      );
    }
    log.step("Post confirmed.");
  },

  async readPosts({ page, options, log }) {
    const limit = options.limit ?? 10;

    log.step("Locating your profile...");
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded" });
    const link = await firstVisible(page, OWN_PROFILE_LINK, 8000);
    const href = (await link?.getAttribute("href")) ?? null;

    // Derive the recent-activity URL from the profile link; fall back to the
    // /in/me/ alias if the link could not be found.
    let activityUrl = "https://www.linkedin.com/in/me/recent-activity/all/";
    if (href) {
      const path = href.startsWith("http") ? new URL(href).pathname : href;
      const base = (path.split("?")[0] ?? path).replace(/\/$/, "");
      activityUrl = `https://www.linkedin.com${base}/recent-activity/all/`;
    }

    log.step("Opening your recent activity...");
    await page.goto(activityUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    log.step(`Collecting up to ${limit} post(s)...`);
    return collectPosts(page, {
      limit,
      log,
      // FRAGILE: activity feed update units. Patch if the DOM changes.
      unit: "div.feed-shared-update-v2, li.profile-creator-shared-feed-update__container",
      text: ".update-components-text, .feed-shared-update-v2__description, .update-components-update-v2__commentary",
      url: 'a[href*="/feed/update/"]',
      time: ".update-components-actor__sub-description, .update-components-actor__sub-description-link",
    });
  },
};
