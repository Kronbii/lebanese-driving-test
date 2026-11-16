/**
 * Mobile viewport regression check.
 *
 *   npm run dev:all            (in another terminal; seed first for the school pages)
 *   npm run test:viewport      BASE_URL=http://localhost:5173 CHROME_PATH=/usr/bin/google-chrome
 *
 * Opens each key page at phone and tablet sizes in Arabic (RTL) and English (LTR) and
 * fails if the page scrolls horizontally or logs a console error. Uses the system Chrome
 * through playwright-core (no browser download).
 */
import { existsSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const CANDIDATES = [process.env.CHROME_PATH, "/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
const CHROME = CANDIDATES.find((path) => path && existsSync(path));

const ROUTES = [
  "/",
  "/practice",
  "/signs",
  "/signs/flashcards",
  "/signs/reverse",
  "/signs/drill",
  "/notebook",
  "/progress",
  "/settings",
  "/profiles",
  "/join",
  "/question/127",
  "/privacy",
  "/s/demo",
  "/s/demo/learn",
  "/live",
  "/staff/login",
  "/embed/demo"
];

const VIEWPORTS = [
  { name: "phone", width: 375, height: 812 },
  { name: "small-phone", width: 320, height: 640 },
  { name: "tablet", width: 768, height: 1024 }
];

async function check(page: Page, url: string): Promise<string[]> {
  const problems: string[] = [];
  const errors: string[] = [];
  const onConsole = (message: { type: () => string; text: () => string }) => {
    if (message.type() === "error" && !/Failed to load resource|favicon/.test(message.text())) errors.push(message.text());
  };
  page.on("console", onConsole);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const offenders: string[] = [];
    if (doc.scrollWidth > doc.clientWidth + 1) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        const rect = element.getBoundingClientRect();
        if (rect.right > doc.clientWidth + 1 || rect.left < -1) {
          if (getComputedStyle(element).position === "fixed") continue;
          offenders.push(`${element.tagName.toLowerCase()}.${element.className.toString().split(" ").join(".")}`);
          if (offenders.length >= 3) break;
        }
      }
    }
    return { scroll: doc.scrollWidth, client: doc.clientWidth, offenders };
  });
  if (overflow.scroll > overflow.client + 1) {
    problems.push(`horizontal scroll ${overflow.scroll}px > ${overflow.client}px (${overflow.offenders.join(", ")})`);
  }
  if (errors.length) problems.push(`console errors: ${errors.slice(0, 3).join(" | ")}`);
  page.off("console", onConsole);
  return problems;
}

async function main() {
  if (!CHROME) throw new Error("No Chrome found. Set CHROME_PATH.");
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  let failures = 0;
  for (const lang of ["ar", "en"] as const) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
      await context.addInitScript((language) => {
        localStorage.setItem("ldt_settings_v1", JSON.stringify({ lang: language }));
      }, lang);
      const page = await context.newPage();
      for (const route of ROUTES) {
        const problems = await check(page, `${BASE_URL}${route}`);
        const label = `${lang} ${viewport.name.padEnd(11)} ${route}`;
        if (problems.length) {
          failures += 1;
          console.log(`✗ ${label}\n    ${problems.join("\n    ")}`);
        } else {
          console.log(`✓ ${label}`);
        }
      }
      await context.close();
    }
  }
  await browser.close();
  if (failures) {
    console.error(`\n${failures} page/viewport combinations failed.`);
    process.exit(1);
  }
  console.log("\nAll pages fit every viewport.");
}

void main();
