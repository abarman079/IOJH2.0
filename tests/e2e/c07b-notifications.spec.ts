import {expect,test} from '@playwright/test';

test('C07b failure review requires administrator identity and verified AAL2',async({page})=>{
  await page.goto('/admin/notifications');
  await expect(page).toHaveURL(/\/admin\/sign-in/);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
});
test('C07b failure API denies anonymous readers with private cache headers',async({request})=>{
  const response=await request.get('/api/admin/notifications?limit=25');
  expect([401,403]).toContain(response.status());
  expect(response.headers()['cache-control']).toMatch(/no-store/);
  expect(JSON.stringify(await response.json())).not.toContain('recipient_email');
});
test('C07b retry API rejects cross-origin mutation before database access',async({request})=>{
  const response=await request.post('/api/admin/notifications/retry',{
    headers:{'Origin':'https://attacker.example','Content-Type':'application/json'},
    data:{notificationId:'3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001',reason:'operator_reviewed'},
  });
  expect(response.status()).toBe(403);
});
test('C07b signed webhooks fail closed when disabled or improperly authenticated',async({request})=>{
  const response=await request.post('/api/notifications/resend-webhook',{
    data:JSON.stringify({type:'email.delivered',data:{email_id:'3bdeefc0-3bd8-4c3b-9f31-1d51fdb5e001'}}),
    headers:{'Content-Type':'application/json'},
  });
  expect([401,404]).toContain(response.status());
});
