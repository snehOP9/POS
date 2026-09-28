import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const enterPreview = async (page: Page, role: "Waiter" | "Guest") => {
  await page.goto(role === "Waiter" ? "/staff/login" : "/customer/login");
  if (role === "Waiter") await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Preview " + role }).click();
  await expect(page).toHaveURL(role === "Waiter" ? /\/waiter$/ : /\/menu$/);
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
