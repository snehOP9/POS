import { expect, test, type Page } from "@playwright/test";

const enterCashierPreview = async (page: Page) => {
  await page.goto("/staff/login");
  await page.getByRole("button", { name: "Preview Cashier" }).click();
  await expect(page).toHaveURL(/\/cashier$/);
};

test("Cashier groups availability by category and keeps dishes alphabetical", async ({ page }) => {
  await enterCashierPreview(page);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Availability by category" })).toBeVisible();
  const categories = await page.locator(".availability-category summary strong").allTextContents();
  expect(categories).toEqual([...categories].sort((left, right) => left.localeCompare(right)));
  const firstCategory = page.locator(".availability-category").first();
  await firstCategory.locator("summary").click();
  const itemNames = await firstCategory.locator(".menu-availability-list article strong").allTextContents();
  expect(itemNames).toEqual([...itemNames].sort((left, right) => left.localeCompare(right)));
});

test("Cashier table picker shows live occupancy status after selecting a table", async ({ page }) => {
  await enterCashierPreview(page);
  await page.getByRole("combobox", { name: "Table" }).selectOption({ index: 1 });
  await expect(page.locator(".table-selector__meta")).toContainText("Available");
  await expect(page.locator(".table-selector__legend")).toContainText("Occupied");
  await expect(page.locator(".cashier-guest-control")).toBeVisible();
});


test("Cashier can settle, fulfil, and complete a ready preview order", async ({ page }) => {
  await enterCashierPreview(page);
  await page.getByRole("button", { name: "Payments", exact: true }).click();

  const paymentCard = page.locator(".operations-order-card").filter({ hasText: "#1044" });
  await expect(paymentCard).toBeVisible();
  await paymentCard.getByLabel("Cash received for #1044").fill("1200");
  await expect(paymentCard).toContainText("Change:");
  await paymentCard.getByRole("button", { name: "Take cash" }).click();
  await expect(paymentCard).toHaveCount(0);

  await page.getByRole("button", { name: /^Orders/ }).click();
  const orderCard = page.locator(".operations-order-card").filter({ hasText: "#1044" });
  await expect(orderCard.getByRole("button", { name: "Mark ready items served" })).toBeVisible();
  await orderCard.getByRole("button", { name: "Mark ready items served" }).click();
  await expect(orderCard.getByRole("button", { name: "Complete order" })).toBeVisible();
  await orderCard.getByRole("button", { name: "Complete order" }).click();
  await expect(orderCard).toContainText("Completed");
});


test("Cashier operational cards fit phone and tablet viewports", async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await enterCashierPreview(page);
    await page.getByRole("button", { name: "Payments", exact: true }).click();
    await expect(page.locator(".operations-order-card").filter({ hasText: "#1044" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
