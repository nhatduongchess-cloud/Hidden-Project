import { test, expect } from '@playwright/test';
import { mockMapServices } from './roadMocks';

test('real solver, dispatch, separate driver phone, live GPS, stop, renewal and finish', async ({ page, browser }) => {
  await mockMapServices(page);
  await page.goto('/#hub-fleet');
  await expect(page.getByText('Đã kết nối trực tiếp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tối ưu nhiều xe' }).click();
  const assign = page.getByRole('button', { name: /Giao tuyến cho \d+ xe/ });
  await expect(assign).toBeEnabled({ timeout: 30000 });
  await assign.click();
  await expect(page.getByText('Các chuyến đã giao', { exact: true })).toBeVisible();
  const driverURL = await page.getByRole('link', { name: 'Mở màn hình tài xế' }).first().getAttribute('href');
  expect(driverURL).toContain('#driver-live-');
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 10.801, longitude: 106.66, accuracy: 12 }, permissions: ['geolocation'] });
  const driver = await phone.newPage();
  await mockMapServices(driver);
  await driver.goto(driverURL!);
  await expect(driver.getByRole('button', { name: 'Bật chia sẻ vị trí' })).toBeVisible();
  await expect(driver).toHaveURL(/#driver-live$/);
  expect(await driver.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // GPS is never requested until the driver explicitly enables it.
  await expect(page.getByText('Đang cập nhật', { exact: true })).toHaveCount(0);
  await driver.getByRole('button', { name: 'Bật chia sẻ vị trí' }).click();
  await expect(page.getByText('Đang cập nhật', { exact: true }).first()).toBeVisible({ timeout: 15000 });
  await expect(driver.getByText(/Lần gửi thành công/)).toBeVisible();
  await driver.getByRole('button', { name: 'Dừng chia sẻ vị trí' }).click();
  await expect(page.getByText('Đã dừng chia sẻ', { exact: true }).first()).toBeVisible();
  await driver.getByRole('button', { name: 'Bắt đầu chuyến', exact: true }).click();
  while (await driver.getByRole('button', { name: 'Xác nhận đã thu gom', exact: true }).count()) {
    await driver.getByRole('button', { name: 'Xác nhận đã thu gom', exact: true }).first().click();
    await driver.getByRole('button', { name: 'Xác nhận hoàn thành', exact: true }).click();
    await expect(driver.getByRole('dialog')).not.toBeVisible();
  }
  await driver.getByRole('button', { name: 'Hoàn tất chuyến tại điểm tiếp nhận' }).click();
  await expect(driver.getByText('Chuyến đã kết thúc', { exact: true })).toBeVisible();
  await expect(page.getByText('Chuyến đã kết thúc', { exact: true }).first()).toBeVisible();
  await phone.close();
});

test('mobile planner has no overflow; editing invalidates a preview; missing road data blocks dispatch', async ({ page }) => {
  await mockMapServices(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#hub-fleet');
  await expect(page.getByText('Đã kết nối trực tiếp', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Tối ưu nhiều xe' }).click();
  await expect(page.getByText('Phương án đề xuất', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByRole('group', { name: 'XE-01', exact: true }).getByLabel('Tải trọng (kg)').fill('600');
  await expect(page.getByText('Phương án đề xuất', { exact: true })).toHaveCount(0);
  await page.route('**/sources_to_targets*', route => route.abort());
  await page.route('**/table/v1/**', route => route.abort());
  await page.reload(); // A new session has no cached successful road matrix.
  await expect(page.getByText('Đã kết nối trực tiếp', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tối ưu nhiều xe' }).click();
  await expect(page.getByText(/Chỉ là ước tính đường thẳng/)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /Giao tuyến cho \d+ xe/ })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('driver permission denial is actionable and does not send a position', async ({ page, browser, request }) => {
  await mockMapServices(page);
  await page.goto('/#hub-fleet');
  await expect(page.getByText('Đã kết nối trực tiếp', { exact: true })).toBeVisible();
  await request.post('/api/fleet/end', { headers: { Authorization: 'Bearer isolated-browser-test-operator-key' }, data: {} });
  await page.getByRole('button', { name: 'Tối ưu nhiều xe' }).click();
  const assign = page.getByRole('button', { name: /Giao tuyến cho \d+ xe/ });
  await expect(assign).toBeEnabled({ timeout: 30000 }); await assign.click();
  const url = await page.getByRole('link', { name: 'Mở màn hình tài xế' }).first().getAttribute('href');
  const context = await browser.newContext();
  const driver = await context.newPage(); await mockMapServices(driver);
  await driver.addInitScript(() => {
    navigator.geolocation.watchPosition = (_ok, fail) => { setTimeout(() => fail?.({ code: 1, message: 'Denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }), 0); return 1; };
    navigator.geolocation.clearWatch = () => {};
  });
  await driver.goto(url!);
  await driver.getByRole('button', { name: 'Bật chia sẻ vị trí' }).click();
  await expect(driver.getByRole('alert')).toContainText('Chưa được cấp quyền vị trí');
  await expect(driver.getByRole('button', { name: 'Bật chia sẻ vị trí' })).toBeVisible();
  await expect(page.getByText('Đang cập nhật', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Kết thúc đợt điều phối', exact: true }).click();
  await page.getByRole('button', { name: 'Kết thúc và thu hồi liên kết', exact: true }).click();
  await expect(driver.getByText('Vị trí đã dừng gửi.', { exact: false })).toBeVisible({ timeout: 15000 });
  await context.close();
});
