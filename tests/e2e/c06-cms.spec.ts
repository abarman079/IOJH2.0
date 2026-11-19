import {expect,test} from '@playwright/test';
for(const locale of ['en','bn']){
 test(`${locale} unseeded research note does not expose a draft`,async({page})=>{
  const res=await page.goto(`/${locale}/research-notes/unpublished-fixture`);
  expect(res?.status()).toBe(404);
 });
}
test('anonymous media mutations are rejected',async({request})=>{
 const result=await request.post('/api/admin/cms/media',{multipart:{rightsHolder:'Example',license:'Owned',altEn:'Example image'}});
 expect([401,403]).toContain(result.status());
 expect(result.headers()['cache-control']).toMatch(/no-store/);
});
test('anonymous cannot access admin private media',async({request})=>{
 const result=await request.get('/api/admin/cms/media/123e4567-e89b-42d3-a456-426614174000');
 expect([401,403]).toContain(result.status());
});
test('unapproved media is never exposed publicly',async({request})=>{
 const result=await request.get('/api/cms/media/123e4567-e89b-42d3-a456-426614174000');
 expect(result.status()).toBe(404);
});
test('CMS admin page guards direct navigation',async({page})=>{
 await page.goto('/admin/media');
 await expect(page).toHaveURL(/\/admin\/sign-in/);
});
