import { expect, test } from "@playwright/test";

test("public legal, contact, cookie information, and recovery routes are accessible on compact viewports", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/terms");
    await expect(page).toHaveTitle("Terms of use | EmberServe POS");
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy notice" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact and data requests" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }

  await page.goto("/privacy");
  await page.getByRole("button", { name: "Cookie and storage notice" }).click();
  await expect(page.getByRole("dialog", { name: /essential storage supports the service/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /essential storage supports the service/i })).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/privacy$/);

  await page.goto("/contact");
  await expect(page).toHaveTitle("Contact and data requests | EmberServe POS");
  await expect(page.getByRole("heading", { name: "Contact EmberServe POS" })).toBeVisible();
  await expect(page.getByRole("link", { name: "snehraunak.in" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "+91 92419 20176" }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(430);

  await page.goto("/not-a-real-route");
  await expect(page).toHaveTitle("Page not found | EmberServe POS");
  await expect(page.getByRole("link", { name: "Browse menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff sign in" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive");
});
