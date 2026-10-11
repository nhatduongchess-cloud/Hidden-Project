import { test, expect, type Page } from '@playwright/test';
import { mockMapServices } from './roadMocks';

/**
 * Critical paths across the four experiences. Every run starts from the seed.
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

async function startReturn(page: Page) {
  await page.goto('/#app-return');
  await page.getByRole('button', { name: 'Dùng trạm RE-001' }).click();
  await page.getByRole('button', { name: 'Quét mã (mô phỏng)' }).click();
}

test('landing states the concept and its CTAs open the app and RE Hub', async ({ page }) => {
  await page.goto('/#home');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Trả chai PET. Nhận điểm. Theo dõi hành trình tái chế.');
  await expect(page.getByText('Mô hình đề xuất · PCIC 2026').first()).toBeVisible();
  await page.getByRole('link', { name: 'Trải nghiệm trả chai' }).first().click();
  await expect(page.getByText('Bạn đang đứng ở trạm nào?')).toBeVisible();
  await page.goto('/#home');
  await page.getByRole('link', { name: 'Khám phá RE Hub' }).first().click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
});

test('a valid bottle is credited only after it is stored, and appears in history', async ({ page }) => {
  await startReturn(page);
  await page.getByRole('button', { name: 'Đã đặt chai vào khe' }).click();
  await expect(page.getByText('Chai đã vào thùng. Điểm đã được cộng.')).toBeVisible();
  await expect(page.locator('#app-scroll').getByText('+10', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xong' }).click();
  await expect(page.getByRole('heading', { name: 'Cảm ơn bạn. Phiên trả chai đã kết thúc.' })).toBeVisible();
  await page.getByRole('link', { name: 'Xem lịch sử' }).click();
  await expect(page.locator('#app-scroll').getByText('RE-001').first()).toBeVisible();
});

for (const [preset, message] of [
  ['Còn nước', 'Vui lòng đổ hết nước trước khi thử lại.'],
  ['Lon kim loại', 'Trạm hiện chỉ nhận chai PET.'],
  ['Không nhận diện được', 'Chưa nhận diện được chai. Vui lòng lấy chai ra.'],
] as const) {
  test(`returned item: ${preset}`, async ({ page }) => {
    await startReturn(page);
    await page.getByRole('button', { name: preset, exact: true }).click();
    await page.getByRole('button', { name: 'Đã đặt chai vào khe' }).click();
    await expect(page.getByRole('heading', { name: message })).toBeVisible();
    await expect(page.getByText('Lần này không tính điểm.')).toBeVisible();
  });
}

test('a full station stops accepting and suggests another station', async ({ page }) => {
  await startReturn(page);
  // The bin reaches the stop level while the user is at the slot: the station refuses the next bottle.
  await page.getByRole('button', { name: 'Làm đầy 95 %' }).click();
  await page.getByRole('button', { name: 'Đã đặt chai vào khe' }).click();
  await expect(page.getByRole('heading', { name: 'Trạm tạm ngừng nhận. Xem trạm khác.' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Dùng trạm RE-00[23]/ })).toBeVisible();
});

test('offline deposit waits for sync, then syncs once on reconnect', async ({ page }) => {
  await startReturn(page);
  await page.getByRole('switch', { name: 'Kết nối 4G với RE Hub' }).click();
  await page.getByRole('button', { name: 'Đã đặt chai vào khe' }).click();
  await expect(page.getByText('Giao dịch đang chờ đồng bộ.')).toBeVisible();
  await expect(page.getByText('điểm chờ đồng bộ')).toBeVisible();
  await page.getByRole('switch', { name: 'Kết nối 4G với RE Hub' }).click();
  await expect(page.getByText(/đã đồng bộ 1 giao dịch/)).toBeVisible();
});

test('a jam during flattening credits nothing and the station stops', async ({ page }) => {
  await startReturn(page);
  await page.getByRole('switch', { name: 'Gây kẹt rulo ở chai tiếp theo' }).click();
  await page.getByRole('button', { name: 'Đã đặt chai vào khe' }).click();
  await expect(page.getByRole('heading', { name: 'Trạm tạm dừng do sự cố.' })).toBeVisible();
  await page.goto('/#hub');
  await expect(page.getByText('Kẹt rulo').first()).toBeVisible();
});

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
  test('demo controls live in a separate drawer and the hub menu works', async ({ page }) => {
    await page.goto('/#app-return');
    await page.getByRole('button', { name: 'Demo', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Bảng điều khiển demo' })).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await page.goto('/#hub');
    await page.getByRole('button', { name: /Tổng quan/ }).click();
    await page.getByRole('link', { name: 'Tuyến thu gom' }).click();
    await expect(page.getByRole('heading', { name: 'Tuyến thu gom' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
