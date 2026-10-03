import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const enterPreview = async (page: Page, role: "Guest" | "Cashier" | "Waiter" | "Kitchen") => {
  const guest = role === "Guest";
  await page.goto(guest ? "/customer/login" : "/staff/login");
  if (!guest) await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Preview " + role }).click();
  await expect(page.locator(guest ? ".customer-page" : "." + role.toLowerCase() + "-page")).toBeVisible();
};

test("guest signatures filter to signature dishes and preserves a compact first menu window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page, "Guest");
  const cards = page.locator(".menu-grid:not(.menu-grid--skeleton) .menu-card");
  await expect(cards).toHaveCount(12);

  await page.getByRole("button", { name: "Signatures", exact: true }).click();
  await expect(cards).toHaveCount(await page.locator(".featured-ribbon").count());
  await expect(cards.first().locator(".featured-ribbon")).toBeVisible();
});

test("cashier phone keeps the live bill one tap away without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page, "Cashier");
  const billShortcut = page.getByRole("button", { name: /Review live bill/i });
  await expect(billShortcut).toBeVisible();
  await billShortcut.click();
  await expect(page.locator(".pos-bill")).toBeInViewport();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("every phone workspace has no serious WCAG A or AA failures", async ({ page }) => {
  test.setTimeout(60_000);
  for (const role of ["Guest", "Cashier", "Waiter", "Kitchen"] as const) {
    await page.setViewportSize({ width: 390, height: 844 });
    await enterPreview(page, role);
    await page.addScriptTag({ content: axe.source });
    const result = await page.evaluate(async () => {
      const runner = window as typeof window & { axe: typeof axe };
      return runner.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
    });
    expect(result.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? "")), role).toEqual([]);
  }
});
