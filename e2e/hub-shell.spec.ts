import { test, expect } from '@playwright/test';
import { mockMapServices } from './roadMocks';

test.beforeEach(async ({ page }) => {
  await mockMapServices(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('root and retired project links open only the Hub workspace', async ({ page }) => {
  for (const hash of ['', '#home', '#pilot', '#design', '#explorer-flatten', '#app-return']) {
    await page.goto(`/${hash}`);
    await expect(page).toHaveURL(/#hub$/);
    await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Chọn trải nghiệm' })).toHaveCount(0);
    await expect(page.getByText('Bản mẫu tương tác', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/PCIC 2026/)).toHaveCount(0);
  }
});

test('all requested operations are reachable from the Hub navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'RE Hub', exact: true });
  for (const [label, hash, title] of [
    ['Bản đồ trạm', 'hub-map', 'Bản đồ trạm'],
    ['Số lượng thu gom', 'hub-analytics', 'Số lượng thu gom'],
    ['Dự báo mức đầy', 'hub-forecasts', 'Dự báo mức đầy'],
    ['Đội xe trực tiếp', 'hub-fleet', 'Đội xe & vị trí trực tiếp'],
    ['Truy xuất & báo cáo EPR', 'hub-trace', 'Truy xuất'],
    ['Hiệu quả vận hành', 'hub-kpis', 'Hiệu quả vận hành'],
  ]) {
    await nav.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${hash}$`));
    await expect(page.locator('main h1')).toContainText(title);
  }
});

test('mobile header starts at the top and the map is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const header = page.locator('.ops-shell header');
  expect((await header.boundingBox())!.y).toBe(0);
  await header.getByRole('button').click();
  await page.getByRole('dialog').getByRole('link', { name: 'Bản đồ trạm', exact: true }).click();
  await expect(page.locator('main h1')).toHaveText('Bản đồ trạm');
  await expect(page.getByLabel('Tìm trạm trên bản đồ')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
