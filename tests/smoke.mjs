import { chromium } from "playwright";
import assert from "node:assert/strict";

const baseURL = process.env.SITE_URL;
if (!baseURL) throw new Error("SITE_URL is not set");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];

page.on("pageerror", error => errors.push(`PAGE ERROR: ${error.message}`));
page.on("console", message => {
  if (message.type() === "error") errors.push(`CONSOLE ERROR: ${message.text()}`);
});
page.on("requestfailed", request => {
  errors.push(`REQUEST FAILED: ${request.url()} — ${request.failure()?.errorText || "unknown"}`);
});

try {
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#page-dashboard").waitFor({ state: "visible", timeout: 15000 });

  // 1. Dashboard -> New trip navigation
  await page.locator('[data-go="new-trip"]').first().click();
  await page.waitForFunction(() => location.hash === "#new-trip");

  // 2. Complete the three-step trip wizard
  await page.locator('input[name="destination"]').fill("일본 오사카");
  await page.locator('input[name="startDate"]').fill("2026-12-23");
  await page.locator('input[name="endDate"]').fill("2026-12-27");
  await page.locator("#wizardNext").click();
  await page.locator("#wizardNext").click();
  await page.locator("#wizardNext").click();

  await page.waitForFunction(() => location.hash === "#itinerary");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("voyage-planner-data-v1") || "null"));
  assert.ok(saved?.trips?.length === 1, "Trip was not saved to localStorage");
  assert.equal(saved.trips[0].itinerary?.length, 5, "A Dec 23–27 trip should contain all five calendar days");
  assert.deepEqual(saved.trips[0].itinerary.map(day => day.date), ["2026-12-23", "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-27"], "Itinerary dates are incorrect");

  // 3. Trip list route and card rendering
  await page.locator('[data-route="trips"]').first().click();
  await page.waitForFunction(() => location.hash === "#trips");
  await page.locator("#allTrips .trip-card").first().waitFor({ state: "visible" });

  // 4. Theme control
  await page.locator("#themeToggle").click();
  const theme = await page.locator("html").getAttribute("data-theme");
  assert.equal(theme, "dark", "Theme toggle did not switch to dark mode");

  if (errors.length) throw new Error("Browser errors detected:\n" + errors.join("\n"));
  console.log("SMOKE TEST PASSED: page boot, navigation, trip creation, local save, inclusive itinerary dates, trip list, theme toggle.");
} finally {
  await browser.close();
}
