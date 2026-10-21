import { test, expect } from '@playwright/test';
import { mockMapServices } from './roadMocks';

test.beforeEach(async ({ page }) => {
  await mockMapServices(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#hub');
});

test('network search, selected station and forecast navigation', async ({ page }) => {
  await page.getByLabel('Tìm trạm trên bản đồ').fill('thu vien');
  await expect(page.locator('.ops-station-card')).toHaveCount(1);
  await page.locator('.ops-station-card').click();
  await expect(page.getByRole('link', { name: 'Xem chi tiết', exact: true })).toHaveAttribute('href', '#hub-station-RE-003');
  await page.getByRole('link', { name: 'Xem dự báo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dự báo mức đầy', exact: true })).toBeVisible();
  await page.getByLabel('Kịch bản nhu cầu').selectOption('0.6');
  await page.reload();
  await expect(page.getByLabel('Kịch bản nhu cầu')).toHaveValue('0.6');
});

test('collection summary filters, chart unit and CSV download', async ({ page }) => {
  await page.goto('/#hub-analytics');
  await page.locator('#analytics-station').selectOption('RE-001');
  const table = page.getByRole('table').last();
  await expect(table.getByRole('link', { name: 'RE-001', exact: true })).toBeVisible();
  await expect(table.getByText('RE-002')).toHaveCount(0);
  await page.getByRole('radio', { name: 'Số chai', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Xu hướng số chai theo ngày' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất thống kê CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^re-thong-ke-.*\.csv$/);
});

test('infeasible route cannot be assigned, valid route can be shared', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#hub-routes');
  await page.getByRole('button', { name: 'Giao tuyến cho tài xế' }).waitFor();
  await page.locator('#rt-payload').fill('8');
  await expect(page.getByRole('button', { name: 'Giao tuyến cho tài xế' })).toBeDisabled();
  await page.locator('#rt-payload').fill('500');
  await expect(page.getByRole('button', { name: 'Giao tuyến cho tài xế' })).toBeEnabled();
  await page.getByRole('button', { name: 'Giao tuyến cho tài xế' }).click();
  await page.getByRole('button', { name: 'Chia sẻ lộ trình' }).click();
  await expect(page.getByLabel('Nội dung gửi tài xế')).toContainText('RE-003');
  await expect(page.getByLabel('Nội dung gửi tài xế')).toContainText('openstreetmap.org');
});

for (const route of ['hub', 'hub-analytics', 'hub-forecasts', 'hub-kpis']) {
  test(`mobile ${route} stays within viewport`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/#${route}`);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('body')).not.toContainText('NaN');
  });
}
