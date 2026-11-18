import { expect, test } from '@playwright/test';

// Anonymous and malicious-input smoke tests. These are not a substitute for
// testing a real AAL2 owner and a disposable database under separate identities.
for (const path of ['/admin', '/admin/mfa'] as const) {
  test(`C05c: anonymous ${path} stays inaccessible with spoofed role hints`, async ({ page }) => {
    const response = await page.goto(`${path}?role=admin&aal=aal2&is_admin=true`);
    expect(response).not.toBeNull();
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    await expect(page.getByText('Administrative access is protected.')).toHaveCount(0);
  });
}

test('C05c: direct API cannot be authorized through URL or forged headers', async ({ request }) => {
  const res = await request.get('/api/admin/security-check?role=admin&aal=aal2', {
    headers: { 'x-iojh-admin': 'true', 'x-user-role': 'admin', 'x-auth-aal': 'aal2' }
  });
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual({ authorized: false });
  expect(res.headers()['cache-control']).toContain('no-store');
  expect(res.headers()['referrer-policy']).toBe('no-referrer');
});

test('C05c: admin server responses are not shared-cacheable', async ({ page }) => {
  const response = await page.goto('/admin/sign-in');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['cache-control']).toContain('no-store');
  await expect(page.getByRole('heading', { name: /secure administrator sign-in/i })).toBeVisible();
});

test('C05c: customer auth and homepage remain navigable', async ({ page }) => {
  await page.goto('/en');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/bn/sign-in');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
