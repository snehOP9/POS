import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";

const enterPreview = async (page: Page, role: "Guest" | "Cashier" | "Waiter" | "Kitchen") => {
  const guest = role === "Guest";
  if (guest) {
    await page.goto("/menu?preview=1");
    await expect(page.locator(".customer-page")).toBeVisible();
    return;
  }
  await page.goto("/staff/login");
  if (!guest) await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Preview " + role }).click();
  await expect(page.locator(guest ? ".customer-page" : "." + role.toLowerCase() + "-page")).toBeVisible();
};

test("guest signatures filter to signature dishes and preserves a compact first menu window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page, "Guest");
  const cards = page.locator(".menu-grid:not(.menu-grid--skeleton) .menu-card");
  await expect(cards).toHaveCount(9);

  await page.getByRole("button", { name: "Signatures", exact: true }).click();
  await expect(cards).toHaveCount(await page.locator(".featured-ribbon").count());
  await expect(cards.first().locator(".featured-ribbon")).toBeVisible();
});

test("guest checkout sends an order directly without a verification route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page, "Guest");
  await expect(page.locator(".customer-page")).toBeVisible();
  await page.locator(".menu-grid .add-button").first().click();
  await page.getByRole("button", { name: /Open cart/i }).click();
  await expect(page.getByRole("button", { name: "Review table order" })).toBeVisible();
  await expect(page.getByLabel(/mobile number/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Review table order" }).click();
  await expect(page.getByRole("button", { name: "Confirm and send" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm and send" }).click();
  await expect(page).toHaveURL(/\/menu\?preview=1$/);
  await expect(page.locator(".tracking-strip")).toContainText("Confirmed");
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
