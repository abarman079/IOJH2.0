import {test,expect} from '@playwright/test';
test('anonymous visitors cannot see the admin desk',async({page})=>{
 await page.goto('/admin');await expect(page).toHaveURL(/\/admin\/sign-in/);
 await expect(page.getByText('Administrative access is protected.')).toHaveCount(0);
});
test('anonymous visitors cannot access MFA enrollment',async({page})=>{
 await page.goto('/admin/mfa');await expect(page).toHaveURL(/\/admin\/sign-in/);
});
test('administrator login is noindex with labeled fields',async({page})=>{
 await page.goto('/admin/sign-in');
 await expect(page.getByRole('heading',{name:/secure administrator sign-in/i})).toBeVisible();
 await expect(page.getByLabel('Email address')).toBeVisible();
 await expect(page.getByLabel('Password')).toBeVisible();
 await expect(page.locator('meta[name=robots]')).toHaveAttribute('content',/noindex/);
});
test('admin sign-in reflows without horizontal scrolling',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/admin/sign-in');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});

test('admin gate API fails closed to anonymous requests',async({request})=>{
 const response=await request.get('/api/admin/security-check');
 expect(response.status()).toBe(401);
 expect(response.headers()['cache-control']).toContain('no-store');
 expect(await response.json()).toEqual({authorized:false});
});
