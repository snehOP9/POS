import { expect, test } from "@playwright/test";

test("footer navigation opens legal pages at the top", async ({ page }) => {
  await page.goto("/menu?preview=1");
  await page.locator(".customer-page").waitFor();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

  await page.locator(".public-footer").getByRole("link", { name: "Terms of use" }).click();
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeInViewport();
  await page.waitForFunction(() => window.scrollY === 0, undefined, { timeout: 250 });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.locator(".public-footer").getByRole("link", { name: "Privacy notice" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "Privacy Notice" })).toBeInViewport();
  await page.waitForFunction(() => window.scrollY === 0, undefined, { timeout: 250 });
});

test("public legal, contact, cookie information, and recovery routes are accessible on compact viewports", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());

  for (const width of [320, 375, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/terms");
    await expect(page).toHaveTitle("Terms of use | Ember & Grain");
    await expect(page.getByRole("heading", { name: "Terms of Use" })).toBeVisible();
    await expect(page.locator(".legal-page-header").getByRole("link")).toHaveAttribute("href", "/");
    await expect(page.getByRole("link", { name: "Privacy notice" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contact" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }

  await page.goto("/privacy");
  await expect(page.locator(".legal-page-header").getByRole("link")).toHaveAttribute("href", "/");
  await page.getByRole("button", { name: "Cookie and storage notice" }).click();
  await expect(page.getByRole("dialog", { name: /essential storage supports the service/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /essential storage supports the service/i })).toBeHidden();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/privacy$/);

  await page.goto("/contact");
  await expect(page).toHaveTitle("Contact | Ember & Grain");
  await expect(page.getByRole("heading", { name: "Contact the restaurant" })).toBeVisible();
  await expect(page.locator(".legal-page-header").getByRole("link")).toHaveAttribute("href", "/");
  await expect(page.getByText("The restaurant has not published a guest contact channel yet.").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "snehraunak.in" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(430);

  await page.goto("/not-a-real-route");
  await expect(page).toHaveTitle("Page not found | EmberServe POS");
  await expect(page.getByRole("link", { name: "Browse menu" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff sign in" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow, noarchive");

  await page.goto("/privacy");
  await page.locator(".legal-page-header").getByRole("link").click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".restaurant-header")).toBeVisible();
});
