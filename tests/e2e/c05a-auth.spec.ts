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
  const showButton = page.getByRole("button", { name: "Show password" });
  // Wait for actual hydration readiness; do not sleep or retry lost clicks.
  await expect(showButton).toBeEnabled();
  await showButton.click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  const hideButton = page.getByRole("button", { name: "Hide password" });
  await expect(hideButton).toHaveAttribute("aria-pressed", "true");
  await hideButton.click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
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

for (const locale of ["en", "bn"] as const) {
  test(`${locale} reset page never claims authorization without a recovery proof`, async ({ page }) => {
    const response = await page.goto(`/${locale}/reset-password`);
    expect(response?.status()).toBe(200);
    const title = locale === "bn" ? "পাসওয়ার্ড পুনরুদ্ধার লিংকটি সক্রিয় নয়।" : "Your recovery link is not active.";
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByRole("button", { name: locale === "bn" ? "নতুন পাসওয়ার্ড সংরক্ষণ করুন" : "Save new password" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: locale === "bn" ? "নতুন পাসওয়ার্ড পুনরুদ্ধার লিংক নিন" : "Request a new reset link" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBeTruthy();
  });
}

test("a fabricated recovery cookie never displays a password form", async ({ page, context }) => {
  await context.addCookies([{
    name: "iojh_recovery_proof", value: "v2.forged.forged.forged.forged.forged",
    url: "http://127.0.0.1:3000", httpOnly: true, sameSite: "Lax",
  }]);
  await page.goto("/en/reset-password");
  await expect(page.getByRole("heading", { name: "Your recovery link is not active." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new password" })).toHaveCount(0);
});

test("an ordinary authenticated session without recovery proof cannot change a password", async ({ page }) => {
  const email = process.env.IOJH_E2E_AUTH_EMAIL;
  const password = process.env.IOJH_E2E_AUTH_PASSWORD;
  test.skip(!email || !password, "Provide dedicated test-account credentials in the terminal for live Supabase denial verification");
  await page.goto("/en/sign-in");
  await page.getByRole("textbox", { name: "Email address" }).fill(email!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/account(?:\?|$)/);
  await page.goto("/en/reset-password");
  await expect(page.getByRole("heading", { name: "Your recovery link is not active." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save new password" })).toHaveCount(0);
});

test('query string alone cannot claim a completed password reset', async ({ page }) => {
  await page.goto('/en/sign-in?password_changed=1&success=1');
  await expect(page.getByText('Your password was updated. Please sign in again using your new password.')).toHaveCount(0);
});

test('fabricated post-reset success cookie cannot claim password change', async ({ page, context }) => {
  await context.addCookies([{
    name: 'iojh_reset_notice', value: 'v1.en.changed.1790000000.forged.fake',
    url: 'http://127.0.0.1:3000/en/sign-in', httpOnly: true, sameSite: 'Lax',
  }]);
  await page.goto('/en/sign-in');
  await expect(page.getByText('Your password was updated. Please sign in again using your new password.')).toHaveCount(0);
});
