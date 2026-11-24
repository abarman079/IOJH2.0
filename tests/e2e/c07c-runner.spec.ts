import {test,expect} from '@playwright/test';
test.use({trace:'off'});
const path='/api/internal/jobs/run';
test('runner rejects unauthenticated calls before claiming and never caches',async({request})=>{
 const response=await request.post(path,{data:{}});
 expect([401,503]).toContain(response.status());
 expect(response.headers()['cache-control']).toContain('no-store');
 expect(await response.json()).toEqual({error:response.status()===401?'Unauthorized':'Runner unavailable'});
});
test('runner rejects incorrect credential and unsupported method',async({request})=>{
 const bad=await request.post(path,{headers:{Authorization:`Bearer ${'0'.repeat(64)}`},data:{}});
 expect([401,503]).toContain(bad.status());
 const get=await request.get(path);expect(get.status()).toBe(405);expect(get.headers().allow).toBe('POST');
});
test('anonymous worker health page is protected',async({page})=>{
 await page.goto('/admin/operations');await expect(page).toHaveURL(/\/admin\/sign-in/);
});
// Explicit local fixture opt-in: never run authorized requests against a hosted server.
test.describe('disposable local authorized request (trace disabled)',()=>{

 test('authorized local probe rejects parameters and returns redacted summary',async({request,baseURL})=>{
 const key=process.env.IOJH_TEST_RUNNER_SECRET;
 test.skip(!key||process.env.IOJH_TEST_RUNNER_LOCAL!=='true','Requires disposable local runner fixture and owner-controlled secret');
 expect(new URL(baseURL!).hostname).toMatch(/^(localhost|127\.0\.0\.1)$/);
 const headers={Authorization:`Bearer ${key}`};
 expect((await request.post(path,{headers,data:{limit:100}})).status()).toBe(400);
 expect((await request.post(path,{headers,data:'x'.repeat(65)})).status()).toBe(400);
 const result=await request.post(path,{headers,data:{}});expect(result.status()).toBe(200);
 const body=await result.json();expect(Object.keys(body).sort()).toEqual(['busy','ok','summary']);expect(JSON.stringify(body)).not.toContain(key!);
});
});
