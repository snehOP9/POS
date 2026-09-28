import { expect, test, type Page } from "@playwright/test";

type Preview = {
  role: "Guest" | "Cashier" | "Waiter" | "Kitchen";
  root: string;
};

const previews: Preview[] = [
  { role: "Guest", root: ".customer-page" },
  { role: "Cashier", root: ".cashier-page" },
  { role: "Waiter", root: ".waiter-page" },
  { role: "Kitchen", root: ".kitchen-page" },
];

const viewports = [
  { name: "compact phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

const enterPreview = async (page: Page, role: Preview["role"]) => {
  if (role === "Guest") {
    await page.goto("/customer/login");
    await page.getByRole("button", { name: "Preview Guest" }).click();
    return;
  }
  await page.goto("/staff/login");
  await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Preview " + role }).click();
};

test("every preview workspace fits compact phones, tablets, and desktop", async ({ page }) => {
  test.setTimeout(90_000);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const preview of previews) {
      await enterPreview(page, preview.role);
      await expect(page.locator(preview.root)).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
        message: preview.role + " should not overflow at " + viewport.name,
      }).toBe(true);
      await expect(page.locator(".vite-error-overlay")).toHaveCount(0);
      if (viewport.width <= 390 && preview.role === "Guest") await expect(page.locator(".search-field input").first()).toHaveCSS("font-size", "16px");
      if (viewport.width <= 390 && preview.role === "Cashier") await expect(page.locator(".cash-input input")).toHaveCSS("font-size", "16px");
      if (viewport.width <= 390 && preview.role === "Waiter") await expect(page.locator(".waiter-mobile-nav button").first()).toHaveCSS("min-height", "44px");
    }
  }
});
