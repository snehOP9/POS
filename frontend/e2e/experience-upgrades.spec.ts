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
  await expect(cards).toHaveCount(12);

  await page.getByRole("button", { name: "Signatures", exact: true }).click();
  await expect(cards).toHaveCount(await page.locator(".featured-ribbon").count());
  await expect(cards.first().locator(".featured-ribbon")).toBeVisible();
});

test("guest mobile OTP verification resumes the saved order without a password screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let firebaseToken = "";
  let createdOrder = false;
  await page.route("**/api/v1/auth/customer/firebase/verify", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    firebaseToken = body.idToken;
    await route.fulfill({ json: { success: true, data: { accessToken: "test-customer-token", user: { name: "Guest", role: "CUSTOMER" } } } });
  });
  await page.route("**/api/v1/orders**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { success: true, data: [] } });
      return;
    }
    createdOrder = true;
    await route.fulfill({ json: { success: true, data: { id: "otp-order", orderNumber: "EG-1001", mode: "PICKUP", status: "PLACED", paymentStatus: "UNPAID", items: [], pricing: { grandTotalPaise: 10000 } } } });
  });
  await page.goto("/menu?preview=1&guestAuth=0&firebaseTest=1");
  await expect(page.locator(".customer-page")).toBeVisible();
  await page.locator(".menu-grid .add-button").first().click();
  await page.getByRole("button", { name: /Open cart/i }).click();
  await page.getByRole("button", { name: "Verify mobile to continue" }).click();
  await expect(page).toHaveURL(/\/customer\/verify/);
  await expect(page.getByText("Sign in to order", { exact: true })).toHaveCount(0);
  await page.getByLabel("Mobile number").fill("98765 43210");
  await page.getByRole("button", { name: "Send OTP" }).click();
  await expect(page.getByLabel("6-digit OTP")).toBeVisible();
  await page.getByLabel("6-digit OTP").fill("123456");
  await page.getByRole("button", { name: /Confirm OTP & place order/i }).click();
  await expect.poll(() => createdOrder).toBe(true);
  expect(firebaseToken).toBe("firebase-test-phone:+919876543210");
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
