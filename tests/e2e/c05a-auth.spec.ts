import { expect, test } from "@playwright/test";

for (const locale of ["en", "bn"] as const) {
  test(`${locale} auth pages are bilingual, noindex and have no horizontal overflow`, async ({ page }) => {
    for (const route of ["sign-in", "sign-up", "forgot-password", "verify-email"]) {
      const response = await page.goto(`/${locale}/${route}`);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
    }
  });
  test(`${locale} account denies anonymous access`, async ({ page }) => {
    await page.goto(`/${locale}/account`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in`));
  });
}
test("untrusted return target cannot redirect to another site", async ({ page }) => {
  await page.goto("/en/sign-in?next=https://evil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/en/account");
});
test("sign-in has visible accessible labels and password disclosure", async ({ page }) => {
  await page.goto("/en/sign-in");
  await expect(page.getByRole("textbox", { name: "Email address" })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
});
test('theme switch is hydration safe on identity page', async ({ page }) => {
  await page.goto('/en/sign-in');
  const themeButton = page.getByRole('button', { name: 'Switch color theme' });
  await themeButton.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
test('administrator routes remain inaccessible in C05a', async ({ page }) => {
  expect((await page.goto('/admin'))?.status()).toBe(404);
  expect((await page.goto('/admin/sign-in'))?.status()).toBe(404);
});
