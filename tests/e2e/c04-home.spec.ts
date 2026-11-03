import {expect,test} from '@playwright/test';

for(const locale of ['en','bn'] as const){
 test(`${locale} homepage renders seven sections and has no horizontal overflow`,async ({page})=>{
  await page.goto(`/${locale}`);
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.locator('#capabilities')).toBeVisible();
  await expect(page.locator('#work')).toBeAttached();
  await expect(page.locator('#learn')).toBeAttached();
  await expect(page.locator('#publishing')).toBeAttached();
  await expect(page.locator('#publisher')).toBeAttached();
  await expect(page.locator('#insights')).toBeAttached();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
 });
}
test('service panel changes and route is transparent about being a preview',async ({page,isMobile})=>{
 await page.goto('/en');
 await page.locator('#capabilities').scrollIntoViewIfNeeded();
 const selection=page.getByRole('button',{name:/Journal Development/i});
 await selection.click();
 if(!isMobile) await expect(page.locator('#selected-service-panel')).toContainText('Journal Development');
 await page.getByRole('link',{name:'Journal Development — details'}).click();
 await expect(page.getByRole('heading',{level:1})).toContainText('Journal Development');
 await expect(page.getByText(/not yet live/i)).toBeVisible();
});
test('theme toggles without hiding homepage text',async ({page,isMobile})=>{
 await page.goto('/en');
 if(isMobile){await page.getByRole('button',{name:'Open navigation'}).click();}
 await page.getByRole('button',{name:'Switch color theme'}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme',/(light|dark)/);
 if(isMobile){await page.getByRole('button',{name:'Close navigation'}).click();}
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
});
test('mobile drawer opens and closes from keyboard',async ({page,isMobile})=>{
 test.skip(!isMobile,'Compact navigation only');
 await page.goto('/en');
 await page.getByRole('button',{name:'Open navigation'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.getByRole('dialog')).toBeHidden();
 await expect(page.getByRole('button',{name:'Open navigation'})).toBeFocused();
});
