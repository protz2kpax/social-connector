import type { Page, Locator } from "playwright";
import { SelectorError } from "./errors.js";

/**
 * Tolerant DOM helpers: we try a LIST of candidate selectors and take the
 * first one that matches a visible element. Absorbs language / DOM
 * variations of Facebook (see selectors.ts).
 */

/** Returns the first visible locator among the candidates, or null. */
export async function firstVisible(
  page: Page,
  selectors: readonly string[],
  timeoutMs = 8000,
): Promise<Locator | null> {
  const deadline = Date.now() + timeoutMs;
  // Small polling loop: Facebook hydrates its DOM in several passes.
  while (Date.now() < deadline) {
    for (const sel of selectors) {
      try {
        // A single selector may match several nodes, some of them hidden
        // (FB often duplicates its elements). We walk through ALL matches
        // and return the first that is actually visible — not just
        // .first(), which may land on a hidden node.
        const loc = page.locator(sel);
        const count = await loc.count();
        for (let i = 0; i < count; i++) {
          const nth = loc.nth(i);
          if (await nth.isVisible()) return nth;
        }
      } catch {
        // invalid selector for this page — keep going
      }
    }
    await page.waitForTimeout(250);
  }
  return null;
}

/** Like firstVisible but throws SelectorError if nothing found. */
export async function requireVisible(
  page: Page,
  selectors: readonly string[],
  label: string,
  timeoutMs = 8000,
): Promise<Locator> {
  const loc = await firstVisible(page, selectors, timeoutMs);
  if (!loc) {
    throw new SelectorError(
      `Element not found: "${label}". Selectors tried:\n  - ${selectors.join(
        "\n  - ",
      )}\nThe Facebook UI has probably changed — update src/selectors.ts.`,
    );
  }
  return loc;
}

/** True if at least one of the selectors is present (visible) quickly. */
export async function anyVisible(
  page: Page,
  selectors: readonly string[],
  timeoutMs = 3000,
): Promise<boolean> {
  return (await firstVisible(page, selectors, timeoutMs)) !== null;
}

/** Waits until none of the selectors are visible anymore (e.g. modal closed). */
export async function waitGone(
  page: Page,
  selectors: readonly string[],
  timeoutMs = 20000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await anyVisible(page, selectors, 600))) return true;
    await page.waitForTimeout(400);
  }
  return false;
}
