import { expect, test } from "@playwright/test";

test("public legal routes, cookie information, and recovery are accessible on compact viewports", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/terms");
    await expect(page).toHaveTitle("Terms of use | EmberServe POS");
    await expect(page.getByRole("heading", { name: "Terms of use" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }

  await page.goto("/privacy");
  await page.getByRole("button", { name: "Cookie preferences" }).click();
  await expect(page.getByRole("dialog", { name: /cookie preferences/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /cookie preferences/i })).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/privacy$/);

  await page.goto("/not-a-real-route");
  await expect(page).toHaveTitle("Page not found | EmberServe POS");
  await expect(page.getByRole("link", { name: "Browse menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff sign in" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive");
});
