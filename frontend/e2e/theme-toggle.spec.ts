import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "compact phone", width: 320, height: 568 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];

const publicRoutes = ["/", "/menu?preview=1", "/story", "/visit", "/reservations", "/access", "/privacy", "/terms", "/contact", "/staff/login"];

const enterPreview = async (page: Page, role: "Cashier" | "Waiter" | "Kitchen") => {
  await page.goto("/staff/login");
  await page.getByRole("radio", { name: role }).click();
  await page.getByRole("button", { name: "Preview " + role }).click();
};

const expectThemeControl = async (page: Page, width: number, label: string) => {
  const toggle = page.getByRole("button", { name: /Switch to (light|dark) theme/ });
  await expect(toggle, label + " exposes a visible theme control").toBeVisible();
  const box = await toggle.boundingBox();
  expect(box, label + " theme control has a bounding box").not.toBeNull();
  expect(box!.x, label + " theme control stays on-screen").toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, label + " theme control stays on-screen").toBeLessThanOrEqual(width);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
    message: label + " does not add horizontal overflow",
  }).toBeLessThanOrEqual(width);
};

test("theme preference persists and uses a reduced-motion-safe fallback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectThemeControl(page, 390, "restaurant home");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await page.goto("/menu?preview=1");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectThemeControl(page, 390, "customer menu after navigation");
});

test("theme control and page actions remain reachable in every public route and workspace", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of publicRoutes) {
      await page.addInitScript(() => localStorage.setItem("emberserve.theme", "dark"));
      await page.goto(route);
      await expect(page.locator("html"), route + " applies dark mode").toHaveAttribute("data-theme", "dark");
      await expectThemeControl(page, viewport.width, `${route} at ${viewport.name}`);
      await expect(page.locator(".vite-error-overlay")).toHaveCount(0);
    }
    for (const role of ["Cashier", "Waiter", "Kitchen"] as const) {
      await enterPreview(page, role);
      await expect(page.locator("html"), role + " applies dark mode").toHaveAttribute("data-theme", "dark");
      await expectThemeControl(page, viewport.width, `${role} at ${viewport.name}`);
      await expect(page.locator(".vite-error-overlay")).toHaveCount(0);
    }
  }
});
