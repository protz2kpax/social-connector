import { chromium } from "playwright";
import { firstVisible, anyVisible } from "../src/dom.js";
import { LOGIN } from "../src/selectors.js";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  locale: "fr-FR",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 900 },
});
const page = await ctx.newPage();
await page.goto("https://www.facebook.com/login.php", { waitUntil: "domcontentloaded" });

const accept = await firstVisible(page, LOGIN.cookieAccept, 5000);
console.log("cookie accept trouve (firstVisible corrige):", !!accept);
if (accept) {
  console.log("  aria:", await accept.getAttribute("aria-label"));
  await accept.click();
  // attend disparition
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await anyVisible(page, LOGIN.cookieAccept, 400))) {
    await page.waitForTimeout(250);
  }
}
console.log("banniere encore visible:", await anyVisible(page, LOGIN.cookieAccept, 1000));

// Le bouton login est-il maintenant cliquable (pas intercepte) ?
const clickable = await page.evaluate(() => {
  const login = document.querySelector('[role="button"][aria-label="Se connecter"]') as HTMLElement | null;
  if (!login) return { found: false };
  const r = login.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { found: true, clickable: login.contains(top) || top === login };
});
console.log("login clickable:", JSON.stringify(clickable));

const ok = clickable.found && clickable.clickable;
console.log(ok ? "\n[PASS] cookies fermes, bouton login cliquable." : "\n[FAIL]");
await browser.close();
process.exit(ok ? 0 : 1);
