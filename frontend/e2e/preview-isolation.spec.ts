import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const enterPreview = async (page: Page, role: "Waiter" | "Kitchen" | "Guest") => {
  const isGuest = role === "Guest";
  if (isGuest) {
    await page.goto("/menu?preview=1");
    await expect(page).toHaveURL(/\/menu\?preview=1$/);
    return;
  }
  await page.goto("/staff/login");
  if (!isGuest) await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Preview " + role }).click();
  await expect(page).toHaveURL(role === "Waiter" ? /\/waiter$/ : /\/kitchen$/);
};

test("preview table updates synchronize across tabs without an API mutation", async ({ page, context }) => {
  await enterPreview(page, "Waiter");
  await page.getByRole("button", { name: /T01/ }).click();
  await page.getByRole("button", { name: /Open T01 for 1/ }).click();
  await expect(page.locator(".waiter-order-sheet")).toContainText("1");

  const secondTab = await context.newPage();
  await enterPreview(secondTab, "Waiter");
  await expect(secondTab.locator(".table-card", { hasText: "T01" })).toContainText("1/2 guests");
});

test("guest preview supports keyboard menu search and has no serious WCAG violations", async ({ page }) => {
  await enterPreview(page, "Guest");
  const search = page.getByRole("textbox", { name: "Search menu" });
  await expect(search).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(search).toBeFocused();

  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    const runner = window as typeof window & { axe: typeof axe };
    return runner.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
  });
  expect(result.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
});

test("guest preview stays within mobile and tablet viewports", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await enterPreview(page, "Guest");
    await expect(page.locator(".customer-page")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("guest preview orders reach the kitchen and return a ready update on a phone", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page, "Guest");
  await page.getByRole("button", { name: "Add" }).first().click();
  await page.getByRole("button", { name: /view tray/i }).click();
  await page.getByRole("button", { name: "Send to kitchen" }).click();

  const tracking = page.locator(".tracking-strip");
  await expect(tracking).toContainText("Confirmed");
  const displayId = (await tracking.locator("strong").textContent() ?? "").match(/#\d+/)?.[0];
  expect(displayId).toBeTruthy();

  const kitchen = await context.newPage();
  await kitchen.setViewportSize({ width: 390, height: 844 });
  await enterPreview(kitchen, "Kitchen");
  const ticket = kitchen.locator(".kitchen-ticket", { hasText: displayId! });
  await expect(ticket).toBeVisible();
  await ticket.getByRole("button", { name: "Start cooking" }).click();
  await ticket.getByRole("button", { name: /mark all ready/i }).click();
  await expect(ticket).toContainText("Ready");
  await expect(tracking).toContainText("Ready");
  await expect.poll(() => kitchen.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("preview guest never contacts a live API or socket", async ({ page }) => {
  const liveRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:5173" && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io"))) liveRequests.push(request.url());
  });

  await enterPreview(page, "Guest");
  await expect(page.getByText("Preview sync")).toBeVisible();
  await page.waitForTimeout(300);
  expect(liveRequests).toEqual([]);
});
