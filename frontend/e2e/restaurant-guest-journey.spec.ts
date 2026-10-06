import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("restaurant home, visit, and reservation routes remain clear and responsive without configured API data", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page).toHaveTitle("Ember & Grain | Modern Indian dining");
    await expect(page.getByRole("heading", { name: "A modern Indian table, made for lingering." })).toBeVisible();
    await expect(page.getByAltText("A warmly lit Ember & Grain dining table beside the open kitchen")).toHaveAttribute("src", "/ember-grain-dining-room.png");
    await expect(page.getByRole("link", { name: "Book a table" }).first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await expect(page.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
      await expect(page.locator("#restaurant-mobile-navigation a")).toHaveCount(5);
      await page.getByRole("button", { name: "Close navigation" }).click();
      await page.addScriptTag({ content: axe.source });
      const result = await page.evaluate(async () => {
        const runner = window as typeof window & { axe: typeof axe };
        return runner.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
      });
      expect(result.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""))).toEqual([]);
    }

    await page.goto("/visit");
    await expect(page.getByRole("heading", { name: "Come hungry. Stay awhile." })).toBeVisible();
    await expect(page.getByText("The restaurant address has not been published yet.")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    await page.goto("/reservations");
    await expect(page.getByRole("heading", { name: "We’ll hold the table." })).toBeVisible();
    await expect(page.getByText("A request is not a confirmed booking.")).toBeVisible();
    await expect(page.getByRole("checkbox")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
