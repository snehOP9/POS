import { expect, test } from "@playwright/test";
import axe from "axe-core";

test("mobile hero actions stay centred and fully reachable", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const actions = page.locator(".restaurant-hero__actions a");
    await expect(actions).toHaveCount(2);
    const container = await page.locator(".restaurant-hero__actions").boundingBox();
    expect(container).not.toBeNull();
    for (let index = 0; index < 2; index += 1) {
      const box = await actions.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(container!.x - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(container!.x + container!.width + 1);
    }
    if (width <= 390) {
      const box = await actions.first().boundingBox();
      expect(Math.abs((box!.x + box!.width / 2) - (container!.x + container!.width / 2))).toBeLessThan(2);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

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
