import { collectPosts, requireVisible, waitGone } from "../dom.js";
import { PostFailedError } from "../errors.js";
import type { SocialProvider } from "../types.js";

/**
 * Facebook — posts text to the wall (home feed).
 * FR + EN selectors, tolerant. FRAGILE SPOT: patch if the UI changes.
 */

const COMPOSER_TRIGGER = [
  '[role="button"][aria-label="Créer une publication"]',
  '[role="button"][aria-label="Create a post"]',
  'div[role="button"]:has-text("Quoi de neuf")',
  'div[role="button"]:has-text("What\'s on your mind")',
];

const COMPOSER_INPUT = [
  'div[role="dialog"] div[contenteditable="true"][role="textbox"]',
  'div[role="dialog"] div[contenteditable="true"]',
  'div[aria-label="Quoi de neuf ?"][contenteditable="true"]',
  'div[aria-label^="What\'s on your mind"][contenteditable="true"]',
];

const PUBLISH_BUTTON = [
  'div[role="dialog"] div[aria-label="Publier"][role="button"]',
  'div[role="dialog"] div[aria-label="Post"][role="button"]',
  'div[role="dialog"] [aria-label="Publier"]',
  'div[role="dialog"] [aria-label="Post"]',
];

export const facebook: SocialProvider = {
  id: "facebook",
  label: "Facebook",
  defaultUserDataDir: "./.fb-profile",
  auth: {
    homeUrl: "https://www.facebook.com/",
    loginUrl: "https://www.facebook.com/login.php",
    loggedInMarkers: [
      '[aria-label="Votre profil"]',
      '[aria-label="Your profile"]',
      '[aria-label="Compte"]',
      '[aria-label="Account"]',
      'div[role="navigation"][aria-label="Raccourcis du compte"]',
      'div[role="navigation"][aria-label="Account Controls and Settings"]',
    ],
    loggedOutMarkers: ["input#email", 'input[name="email"]', 'form[action*="login"]'],
    cookieAccept: [
      '[data-cookiebanner="accept_button"]',
      'button[data-testid="cookie-policy-manage-dialog-accept-button"]',
      '[role="button"][aria-label="Autoriser tous les cookies"]',
      '[role="button"][aria-label="Allow all cookies"]',
      'div[aria-label="Autoriser tous les cookies"]',
      'div[aria-label="Allow all cookies"]',
    ],
  },

  async post({ page, content, options, log }) {
    log.step("Loading the home feed...");
    await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });

    log.step("Opening the composer (What's on your mind?)...");
    const trigger = await requireVisible(page, COMPOSER_TRIGGER, "Facebook composer", 12000);
    await trigger.click();
    const input = await requireVisible(page, COMPOSER_INPUT, "composer modal", 10000);

    log.step("Typing the text...");
    await input.click();
    await input.type(content, { delay: 15 });

    if (options.screenshotPath) {
      await page.screenshot({ path: options.screenshotPath }).catch(() => {});
      log.info(`Screenshot: ${options.screenshotPath}`);
    }

    log.step("Clicking Publish...");
    const publish = await requireVisible(page, PUBLISH_BUTTON, "Publish button");
    await publish.click();

    if (!(await waitGone(page, PUBLISH_BUTTON, 20000))) {
      throw new PostFailedError(
        "Facebook post not confirmed (modal stayed open).",
      );
    }
    log.step("Post confirmed.");
  },

  async readPosts({ page, options, log }) {
    const limit = options.limit ?? 10;
    log.step("Opening your profile (facebook.com/me)...");
    await page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded" });
    // Give the timeline a moment to hydrate its first feed units.
    await page.waitForTimeout(2000);

    // After /me redirects, the URL is the user's own profile. Derive the
    // identifier so we can keep only posts they authored — the timeline also
    // surfaces activity (comments on friends' posts) we must skip.
    let me = "";
    try {
      const u = new URL(page.url());
      me = u.pathname.includes("profile.php")
        ? u.searchParams.get("id") ?? ""
        : u.pathname.replace(/\//g, "");
    } catch {
      /* keep me empty -> only the comment filter applies */
    }
    log.info(me ? `Profile id: ${me}` : "Profile id unknown — author filter relaxed.");

    log.step(`Collecting up to ${limit} of your own post(s)...`);
    return collectPosts(page, {
      limit,
      log,
      maxStale: 14,
      // FRAGILE: profile timeline feed units. Patch if the DOM changes.
      unit: 'div[role="article"]',
      text: '[data-ad-preview="message"], div[data-ad-comet-preview="message"], div[dir="auto"]',
      url: 'a[href*="/posts/"], a[href*="story_fbid="], a[href*="/permalink/"]',
      time: 'a[role="link"] span[aria-label], abbr',
      // Keep only authored posts: a /posts/ (or /videos/) permalink owned by
      // the user, never a comment (comment_id) or someone else's story.
      keep: (p) => {
        if (!p.url) return false;
        if (p.url.includes("comment_id=")) return false;
        if (!me) return /\/posts\/|\/videos\/|story_fbid=/.test(p.url);
        return (
          p.url.includes(`/${me}/posts/`) ||
          p.url.includes(`/${me}/videos/`) ||
          (p.url.includes("story_fbid=") && p.url.includes(`id=${me}`))
        );
      },
    });
  },
};
