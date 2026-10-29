// Captures a phone and a desktop screenshot of the running survey with the system Chrome.
// Usage: start the dev server (npm run dev), then: node scripts/screenshots.mjs [baseUrl]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5174";
mkdirSync("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });

async function answerSome(page) {
  await page.locator("#block-q1 [role=checkbox]").first().click();
  await page.locator("#block-q2 [role=radio]").nth(1).click();
  await page.locator("#block-q3 [role=checkbox]").nth(1).click();
  await page.locator("#block-q7 [role=radio]").nth(1).click();
  await page.locator("#block-q7 [role=radio]").nth(6).click();
  await page.locator("#block-q7 [role=radio]").nth(8).click();
  await page.waitForTimeout(200);
}

// Phone: 390 x 844 at 2x, scrolled to the first questions.
const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await phone.goto(base, { waitUntil: "networkidle" });
await answerSome(phone);
await phone.evaluate(() => document.getElementById("block-q1")?.scrollIntoView());
await phone.evaluate(() => window.scrollBy(0, -56));
await phone.waitForTimeout(300);
await phone.screenshot({ path: "docs/screenshots/phone.png" });

// Desktop: 1440 x 900, scrolled to the matrix question.
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await desktop.goto(base, { waitUntil: "networkidle" });
await answerSome(desktop);
await desktop.evaluate(() => document.getElementById("block-q7")?.scrollIntoView());
await desktop.evaluate(() => window.scrollBy(0, -64));
await desktop.waitForTimeout(300);
await desktop.screenshot({ path: "docs/screenshots/desktop.png" });

await browser.close();
console.log("Screenshots written to docs/screenshots/");
