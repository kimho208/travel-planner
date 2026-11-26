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
  // Third-party map embeds may be blocked in CI; first-party application failures are not ignored.
  if (new URL(request.url()).hostname.endsWith("github.io")) {
    errors.push(`REQUEST FAILED: ${request.url()} — ${request.failure()?.errorText || "unknown"}`);
  }
});

try {
  await page.addInitScript(() => {
    const days = ["2026-12-23","2026-12-24","2026-12-25","2026-12-26","2026-12-27"];
    localStorage.setItem("voyage-planner-data-v1", JSON.stringify({
      version: 1, activeTripId: "smoke-trip", theme: "light",
      trips: [{
        id: "smoke-trip", destination: "일본 오사카", startDate: days[0], endDate: days[4],
        travelers: 2, targetBudget: 1500000, style: "관광·명소", transport: "대중교통",
        status: "upcoming", costs: {}, checklist: [],
        itinerary: days.map((date, i) => ({ date, theme: "오사카 탐방", items: [{ time: "10:00", name: "테스트 장소 " + (i + 1) }] }))
      }]
    }));
  });
  await page.goto(baseURL, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#page-dashboard").waitFor({ state: "visible", timeout: 15000 });

  // Existing trip data renders and navigation works.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#menuToggle").click();
  assert.ok(await page.locator("#sidebar").evaluate(el => el.classList.contains("open")), "Mobile drawer should open");
  await page.locator("#sidebarScrim").click({ position: { x: 350, y: 400 } });
  assert.ok(!(await page.locator("#sidebar").evaluate(el => el.classList.contains("open"))), "Scrim should close the drawer");
  await page.locator("#menuToggle").click();
  await page.locator("#sidebar [data-route=\"trips\"]").click();
  assert.ok(!(await page.locator("#sidebar").evaluate(el => el.classList.contains("open"))), "Choosing a route should close the drawer");
  await page.setViewportSize({ width: 1440, height: 1000 });
  assert.equal(await page.locator("#statTrips").textContent(), "1");
  await page.locator('[data-route="itinerary"]').first().click();
  await page.waitForFunction(() => location.hash === "#itinerary");
  await page.locator(".trip-planner-grid").waitFor({ state: "visible" });
  assert.equal(await page.locator(".day-selector .day-tab").count(), 5);

  // Creating an AI trip without signing in must explain the gate, not create a fake draft or console error.
  await page.locator('[data-go="new-trip"]').first().click();
  await page.locator('input[name="destination"]').fill("일본 오사카");
  await page.locator("#dateRangeTrigger").click();
  await page.locator("#calendarNext").click();
  await page.locator('[data-date="2026-12-23"]').click();
  await page.locator('[data-date="2026-12-27"]').click();
  await page.locator("#wizardNext").click();
  await page.locator("#wizardNext").click();
  await page.locator("#wizardNext").click();
  await page.waitForFunction(() => location.hash === "#dashboard");
  await page.locator("#page-dashboard.active").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#authPanel").waitFor({ state: "visible", timeout: 5000 });
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("voyage-planner-data-v1") || "null"));
  assert.equal(saved.trips.length, 1, "An unauthenticated placeholder trip should not be created");
  assert.ok(await page.locator("#authPanel").isVisible(), "Account panel should be visible");
  assert.ok(await page.locator("#authEmail").isVisible(), "Email account ID should be visible");
  assert.ok(await page.locator("#authPassword").isVisible(), "Password field should be visible");
  await page.locator("#authModeToggle").click();
  assert.ok(await page.locator("#authName").isVisible(), "Signup should show a display-name field");
  await page.locator("#authModeToggle").click();
  await page.locator("#authForgot").click();
  assert.ok(await page.locator("#authPassword").isHidden(), "Password field should hide during recovery");
  assert.equal(await page.locator("#authButton").textContent(), "재설정 이메일 보내기");
  await page.locator("#authModeToggle").click();
  assert.ok(await page.locator("#authPassword").isVisible(), "Return to login should restore password field");

  // Detailed checklist and expense tracking controls.
  await page.locator('[data-route="checklist"]').first().click();
  await page.locator("#ckaddPreset").click();
  assert.ok(await page.locator(".checklist-task").count() >= 10, "Recommended checklist should add practical travel tasks");
  await page.locator("#ckname").fill("eSIM 설치 확인");
  await page.locator("#ckcategory").selectOption("tasks");
  await page.locator("#ckpriority").selectOption("high");
  await page.locator("#ckassignee").fill("여행자 1");
  await page.locator("#ckadd").click();
  assert.ok(await page.locator(".checklist-task").filter({ hasText: "eSIM 설치 확인" }).count() === 1, "Checklist task should be created");
  await page.locator('input[data-ck]').first().check();
  await page.locator('[data-route="budget"]').first().click();
  await page.locator("#expenseName").fill("공항 리무진");
  await page.locator("#expenseAmount").fill("24000");
  await page.locator("#expenseCategory").selectOption("transport");
  await page.locator("#expenseAdd").click();
  assert.ok(await page.locator(".expense-row").filter({ hasText: "공항 리무진" }).count() === 1, "Expense should be added");
  assert.ok(await page.locator(".budget-kpi").count() === 4, "Budget summary should show four financial indicators");
  const expense = page.locator(".expense-row").filter({ hasText: "공항 리무진" });
  await expense.locator('[data-expense-edit]').click();
  await page.locator("#expenseAmount").fill("26000");
  await page.locator("#expenseAdd").click();
  assert.ok(await page.locator(".expense-row").filter({ hasText: "₩26,000" }).count() === 1, "Expense edit should update the amount");
  await page.locator(".expense-row").filter({ hasText: "공항 리무진" }).locator('[data-expense-del]').click();
  assert.equal(await page.locator(".expense-row").count(), 0, "Expense delete should remove the record");
  // Trip list and theme controls.
  await page.locator('[data-route="trips"]').first().click();
  await page.waitForFunction(() => location.hash === "#trips");
  await page.locator("#allTrips .trip-card").first().waitFor({ state: "visible" });
  await page.evaluate(() => document.querySelector("#modalBackdrop").classList.add("open"));
  await page.locator("#modalClose").click();
  assert.ok(!(await page.locator("#modalBackdrop").evaluate(el => el.classList.contains("open"))), "Modal close button should dismiss the dialog");
  await page.locator("#themeToggle").click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");

  if (errors.length) throw new Error("Browser errors detected:\n" + errors.join("\n"));
  console.log("SMOKE TEST PASSED: app boot, mobile drawer close, five-day itinerary, auth gate, checklist CRUD, expense CRUD, modal close, trip list, and theme toggle.");
} finally {
  await browser.close();
}
