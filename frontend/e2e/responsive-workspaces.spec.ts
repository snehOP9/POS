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
    await page.goto("/menu?preview=1");
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
      await expect(page.locator(".connection-badge"), preview.role + " exposes its live status at " + viewport.name).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
        message: preview.role + " should not overflow at " + viewport.name,
      }).toBeLessThanOrEqual(viewport.width);
      await expect(page.locator(".vite-error-overlay")).toHaveCount(0);
      if (viewport.width <= 390 && preview.role === "Guest") await expect(page.locator(".search-field input").first()).toHaveCSS("font-size", "16px");
      if (viewport.width <= 390 && preview.role === "Cashier") await expect(page.locator(".cash-input input")).toHaveCSS("font-size", "16px");
      if (viewport.width <= 390 && preview.role === "Waiter") await expect(page.locator(".waiter-mobile-nav button").first()).toHaveCSS("min-height", "44px");
    }
  }
});

test("the interface uses one light theme with no public or profile theme switch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterPreview(page, "Guest");
  await expect(page.locator(".theme-toggle")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /switch to (light|dark) theme/i })).toHaveCount(0);

  await enterPreview(page, "Cashier");
  await page.getByRole("button", { name: /Preview Cashier, Cashier profile/i }).click();
  await expect(page.locator(".staff-profile-appearance")).toHaveCount(0);
});

test("profile choices remain discoverable on phones and tablets", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/access");
    await expect(page.getByRole("heading", { name: "Where are you headed?" })).toBeVisible();
    await expect(page.locator(".access-profile")).toHaveCount(4);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);

    await page.locator(".access-profile", { hasText: "Kitchen" }).click();
    await expect(page).toHaveURL(/\/staff\/login\?role=KITCHEN$/);
    await expect(page.getByRole("radio", { name: "Kitchen" })).toHaveAttribute("aria-checked", "true");
  }
});

test("staff profiles are available from every phone workspace", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const role of ["Cashier", "Waiter", "Kitchen"] as const) {
    await enterPreview(page, role);
    const profile = page.getByRole("button", { name: new RegExp(`Preview ${role}, ${role} profile`, "i") }).first();
    await expect(profile).toBeVisible();
    await profile.click();
    await expect(page.getByRole("dialog", { name: `Preview ${role}` })).toBeVisible();
    await expect(page.getByRole("link", { name: "Switch profile" })).toBeVisible();
    await page.getByRole("button", { name: "Close profile menu" }).click();
  }
});
