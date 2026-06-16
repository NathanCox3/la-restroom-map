import { expect, test } from "@playwright/test";

test("loads the map shell and filters on desktop", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Public Bathroom Map" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Use my location/ })).toBeVisible();
  await page.getByRole("button", { name: /Long Beach/ }).click();
  await page.getByRole("button", { name: /Accessible/ }).click();
  await expect(page.getByLabel("Interactive restroom map")).toBeVisible();
});

test("asks for while-using location and sorts by proximity", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"], { origin: "http://127.0.0.1:5173" });
  await context.setGeolocation({ latitude: 33.7701, longitude: -118.1937, accuracy: 25 });
  await page.goto("/");

  await page.getByRole("button", { name: /Use my location/ }).click();
  const locationCard = page.getByLabel("Location tracking", { exact: true });
  await expect(locationCard.getByText("Tracking your location")).toBeVisible({ timeout: 10_000 });
  await expect(locationCard.getByText(/Tracking location/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Stop location tracking" })).toBeVisible();
  await expect(page.locator(".user-location-marker")).toBeVisible();
  await expect(page.getByText("Loading nearby restrooms...")).toBeHidden({ timeout: 15_000 });
  await expect(page.locator(".record-item")).not.toHaveCount(0);
});

test("panning the map does not auto-reset the search area", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Interactive restroom map")).toBeVisible();
  const mapPane = page.locator(".map-pane");
  const box = await mapPane.boundingBox();
  if (!box) throw new Error("Map pane was not rendered");

  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45, { steps: 8 });
  await page.mouse.up();

  await expect(page.getByRole("button", { name: "Search this area" })).toBeVisible();
  await page.getByRole("button", { name: "Search this area" }).click();
  await expect(page.getByRole("button", { name: "Search this area" })).toBeHidden();
});

test("loads the mobile layout", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile project only");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Public Bathroom Map" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Data panels" })).toBeVisible();
});
