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
