import { chromium } from "playwright";
import { firstVisible } from "./src/dom.js";
import { LOGIN } from "./src/selectors.js";

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
await page.waitForTimeout(2000);

const cookie = await firstVisible(page, LOGIN.cookieAccept, 4000);
console.log("cookieAccept trouve:", !!cookie);
if (cookie) {
  await cookie.click().catch(() => {});
  await page.waitForTimeout(1000);
}

const email = await firstVisible(page, LOGIN.email, 4000);
const pass = await firstVisible(page, LOGIN.password, 4000);
const submit = await firstVisible(page, LOGIN.submit, 4000);
console.log("email trouve:", !!email);
console.log("password trouve:", !!pass);
console.log("submit trouve:", !!submit);
if (submit) console.log("submit aria-label:", await submit.getAttribute("aria-label"));

const ok = !!email && !!pass && !!submit;
console.log(ok ? "\n[PASS] tous les selecteurs login matchent." : "\n[FAIL] selecteur manquant.");
await browser.close();
process.exit(ok ? 0 : 1);
