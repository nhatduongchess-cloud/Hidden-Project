import { test, expect, type Page } from '@playwright/test';
import { mockMapServices } from './roadMocks';

/**
 * Critical operations paths in RE Hub and the driver workspace. Every run starts from the seed.
 * Map tiles and road routing are answered by local stand-ins (see roadMocks.ts).
 * Reduced motion shortens the station animation so the flows stay fast.
 */
test.beforeEach(async ({ page }) => {
  await mockMapServices(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#home');
  await page.evaluate(() => localStorage.clear());
});

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
});
test.afterEach(() => expect(errors).toEqual([]));

test('operator path: attention → schedule → route → driver swaps bin → resolved', async ({ page }) => {
  await page.goto('/#hub');
  const attention = page.getByRole('region', { name: /Cần xử lý/ }).or(page.locator('section').filter({ hasText: 'Cần xử lý' }).first());
  await expect(attention.getByText('RE-003').first()).toBeVisible();
  await page.getByRole('button', { name: 'Lên lịch thu gom' }).first().click();
  await page.getByRole('button', { name: 'Tạo yêu cầu và lập tuyến' }).click();
  await expect(page.getByRole('heading', { name: 'Tuyến thu gom' })).toBeVisible();
  await expect(page.getByText(/Tuyến khả thi/)).toBeVisible();
  await page.getByRole('button', { name: 'Giao tuyến cho tài xế' }).click();
  await expect(page.getByText('Chờ tài xế bắt đầu')).toBeVisible();

  await page.goto('/#driver');
  await page.getByRole('button', { name: 'Bắt đầu tuyến' }).click();
  // Confirm every stop deliberately through the dialog.
  for (let i = 0; i < 3; i++) {
    const next = page.getByRole('button', { name: 'Xác nhận thay thùng' });
    if (!(await next.isVisible())) break;
    await next.click();
    await page.getByRole('button', { name: 'Đã thay thùng' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Đã xử lý hết điểm dừng' })).toBeVisible();
  await page.getByRole('button', { name: 'Kết thúc tuyến' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kết thúc tuyến' }).click();

  await page.goto('/#hub-station-RE-003');
  await expect(page.getByText('Tài xế xác nhận thay thùng')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Việc cần làm' })).toHaveCount(0);
});

test('maintenance: a connectivity request cannot be closed while the station is offline', async ({ page }) => {
  await page.goto('/#hub-station-RE-002');
  await page.getByRole('button', { name: 'Yêu cầu kiểm tra kết nối' }).click();
  await page.getByRole('button', { name: 'Giao yêu cầu' }).click();
  await page.getByRole('button', { name: 'Xác nhận đã xử lý' }).first().click();
  await expect(page.getByText('Chưa xác nhận được')).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Xác nhận đã xử lý' })).toBeDisabled();
});

test('brand path: trace a batch, see evidence gaps, export the EPR support document', async ({ page }) => {
  await page.goto('/#hub');
  await page.getByRole('radio', { name: 'Nhãn hàng' }).first().check({ force: true });
  await expect(page).toHaveURL(/#hub-trace/);
  await page.getByRole('link', { name: 'LO-0001' }).first().click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByText('Thiếu tài liệu từ bên tái chế').first()).toBeVisible();
  await drawer.getByRole('button', { name: 'Đóng' }).click();
  await expect(page.getByText(/Khối lượng cân là của cả lô/)).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất tài liệu EPR' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/re-tai-lieu-ho-tro-epr-.*\.html/);
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('the mobile hub menu opens routes', async ({ page }) => {
    await page.goto('/#hub');
    await page.getByRole('button', { name: /Tổng quan/ }).click();
    await page.getByRole('link', { name: 'Tuyến thu gom', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Tuyến thu gom' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
