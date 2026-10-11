import { test, expect } from '@playwright/test';
import { mockMapServices } from './roadMocks';

/**
 * Road map and navigation for the collection driver. The map services are replaced by local
 * stand-ins; the fallback tests make them fail, as a blocked network would.
 */
const pageErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});
test.afterEach(() => expect(pageErrors).toEqual([]));

async function fresh(page: import('@playwright/test').Page, hash: string) {
  await page.goto('/#home');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
}

test('nearest station by driving time → turn-by-turn → swap the bin on arrival', async ({ page }) => {
  const calls = await mockMapServices(page);
  await fresh(page, '#driver-map');
  await expect(page.getByRole('heading', { name: 'Trạm cần thu gom gần nhất' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Trạm cần thu gom, nhanh nhất trước' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByRole('listitem').first()).toContainText('RE-003');
  await expect(list.getByRole('listitem').first()).toContainText('Nhanh nhất từ vị trí xe');
  await expect(page.getByText(/Đường thực tế · Valhalla/).first()).toBeVisible();
  await expect(page.getByRole('region', { name: /Bản đồ trạm thu gom/ })).toBeVisible();
  expect(calls.tiles).toBeGreaterThan(0);

  await page.getByRole('link', { name: 'Dẫn đường tới RE-003' }).click();
  await expect(page.getByRole('heading', { name: 'RE-003 · Thư viện trung tâm' })).toBeVisible();
  await expect(page.getByText(/phút/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  // East first, then north: the first maneuver is a left turn onto the named street.
  await expect(page.getByText('Rẽ trái vào Đường Tạ Quang Bửu', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '×20' }).click();
  await page.getByRole('button', { name: 'Tới chỗ rẽ' }).click();
  // Past the turn, the banner announces the destination on the right.
  await expect(page.getByText('Đến RE-003 · Thư viện trung tâm, ở bên phải', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tới chỗ rẽ' }).click();
  await expect(page.getByText('Đã đến nơi')).toBeVisible();

  await page.getByRole('button', { name: 'Xác nhận thay thùng' }).click();
  await page.getByRole('button', { name: 'Đã thay thùng' }).click();
  await expect(page.getByText(/Đã thay thùng RE-003/)).toBeVisible();
  await page.getByRole('link', { name: 'Tìm trạm gần nhất tiếp theo' }).click();
  await expect(page.getByText('Tại RE-003 · Thư viện trung tâm')).toBeVisible();
  // The emptied station no longer needs a pickup; the others are ranked from the truck's new position.
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list).not.toContainText('RE-003');
});

test('falls back to OSRM when Valhalla does not answer, and says so', async ({ page }) => {
  const calls = await mockMapServices(page, { answer: ['osrm'] });
  await fresh(page, '#driver-map');
  await expect(page.getByText(/Đường thực tế · OSRM/).first()).toBeVisible();
  expect(calls.valhalla).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Dẫn đường tới RE-003' }).click();
  await expect(page.getByText(/Valhalla · OpenStreetMap không phản hồi/)).toBeVisible();
});

test('the base map falls back to OpenStreetMap France when the main tile server is unreachable', async ({ page }) => {
  const calls = await mockMapServices(page, { tiles: 'fallback' });
  await fresh(page, '#driver-map');
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(3);
  await page.getByRole('link', { name: 'Dẫn đường tới RE-003' }).click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).waitFor();
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count()).toBeGreaterThan(3);
  expect(calls.fallbackTiles).toBeGreaterThan(0);
  await expect(page.getByText(/Không tải được bản đồ nền/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'OpenStreetMap France' })).toBeVisible();
});

test('the base map also falls back when the main tile server hangs instead of failing', async ({ page }) => {
  const calls = await mockMapServices(page, { tiles: 'hang' });
  await fresh(page, '#driver-nav-RE-003');
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count(), { timeout: 15_000 }).toBeGreaterThan(3);
  expect(calls.fallbackTiles).toBeGreaterThan(0);
  await expect(page.getByText(/Không tải được bản đồ nền/)).toHaveCount(0);
});

test('without any routing service, distances are a labelled straight-line estimate', async ({ page }) => {
  await mockMapServices(page, { answer: [], tiles: false });
  await fresh(page, '#driver-map');
  await expect(page.getByText('Ước tính đường thẳng, chưa có dữ liệu đường').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('list', { name: 'Trạm cần thu gom, nhanh nhất trước' }).getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText(/Không tải được bản đồ nền/)).toBeVisible();
  await page.getByRole('link', { name: 'Dẫn đường tới RE-001' }).click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await expect(page.getByText('Không có dữ liệu đường · chỉ hướng theo đường thẳng')).toBeVisible();
});

test('RE Hub plans on road travel times and shows the route on the map', async ({ page }) => {
  await mockMapServices(page);
  await fresh(page, '#hub-routes');
  await expect(page.getByText(/Tuyến khả thi/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bản đồ tuyến đề xuất và tuyến đối chứng' })).toBeVisible();
  await expect(page.getByText(/Đường thực tế · Valhalla/).first()).toBeVisible();
  await expect(page.getByText(/Thời gian và quãng đường giữa các điểm lấy từ dịch vụ định tuyến/)).toBeVisible();
  await page.getByRole('button', { name: 'Giao tuyến cho tài xế' }).click();
  await page.goto('/#driver');
  await expect(page.getByRole('region', { name: /Bản đồ tuyến TU-/ })).toBeVisible();
  await expect(page.getByText('Quãng đường và thời gian theo đường thực tế lúc lập tuyến.')).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu tuyến' }).click();
  await expect(page.getByRole('link', { name: 'Dẫn đường', exact: true })).toBeVisible();
});

test('a smaller collection zone moves stations out of the driver ranking', async ({ page }) => {
  await mockMapServices(page);
  await fresh(page, '#hub-settings');
  await expect(page.getByRole('heading', { name: 'Vị trí trên bản đồ' })).toBeVisible();
  const radius = page.getByLabel('Bán kính phạm vi');
  await radius.fill('0.5');
  await radius.blur();
  await page.goto('/#driver-map');
  const list = page.getByRole('list', { name: 'Trạm cần thu gom, nhanh nhất trước' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list).toContainText('RE-001');
  await expect(page.getByRole('heading', { name: 'Ngoài phạm vi thu gom' })).toBeVisible();
  await expect(page.getByText('Phạm vi thu gom 0,5 km')).toBeVisible();
});
