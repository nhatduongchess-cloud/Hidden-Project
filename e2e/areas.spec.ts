import { test, expect, type Page } from '@playwright/test';
import { mockMapServices } from './roadMocks';

/**
 * Service areas across Viet Nam: picking a city moves the demo stations, depot and receiving
 * point there, and the map, the driver's ranking and navigation follow.
 */
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#home');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test.afterEach(() => expect(errors).toEqual([]));

/** Latitudes sent to the routing service, decoded from Valhalla's json parameter. */
function routedLatitudes(page: Page): number[] {
  const lats: number[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (!url.hostname.startsWith('valhalla')) return;
    const body = JSON.parse(url.searchParams.get('json') ?? '{}');
    for (const l of [...(body.locations ?? []), ...(body.sources ?? []), ...(body.targets ?? [])]) lats.push(l.lat);
  });
  return lats;
}

test('pick Hà Nội in the header, then the driver ranks and navigates to stations there', async ({ page }) => {
  await mockMapServices(page);
  const lats = routedLatitudes(page);
  await page.getByRole('button', { name: /Trạm gần bạn\s*TP\.HCM · minh họa/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chọn khu vực' });
  await expect(dialog.getByRole('button', { name: 'TP. Hồ Chí Minh' })).toHaveAttribute('aria-current', 'true');
  await dialog.getByRole('button', { name: 'Hà Nội' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Trạm gần bạn\s*Hà Nội · minh họa/ })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Trạm gần bạn' })).toContainText('Hà Nội · minh họa');

  await page.goto('/#driver-map');
  await expect(page.getByRole('combobox', { name: 'Khu vực minh họa' })).toHaveValue('hn');
  const list = page.getByRole('list', { name: 'Trạm cần thu gom, nhanh nhất trước' });
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText(/Đường thực tế · Valhalla/).first()).toBeVisible();
  // Every point sent for routing is in Hà Nội (latitude about 21), none left in TP.HCM (about 10.9).
  expect(lats.length).toBeGreaterThan(0);
  expect(lats.every((l) => l > 20.9 && l < 21.2)).toBe(true);

  await list.getByRole('link', { name: /Dẫn đường tới RE-00/ }).first().click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await expect(page.getByText(/^Rẽ (trái|phải) vào /).first()).toBeVisible();
});

test('the area menu on the driver map and in RE Hub moves everything, and reset keeps the area', async ({ page }) => {
  await mockMapServices(page);
  await page.goto('/#driver-map');
  await page.getByRole('combobox', { name: 'Khu vực minh họa' }).selectOption('dn');
  await expect(page.getByText('Đã chuyển trạm minh họa tới Đà Nẵng.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Trạm cần thu gom, nhanh nhất trước' }).getByRole('listitem')).toHaveCount(3);

  await page.goto('/#hub-settings');
  const area = page.getByRole('combobox', { name: 'Khu vực minh họa' });
  await expect(area).toHaveValue('dn');
  await expect(page.getByRole('spinbutton', { name: 'Vĩ độ RE-001' })).toHaveValue(/^16\.07/);
  await area.selectOption('ct');
  await expect(page.getByRole('spinbutton', { name: 'Vĩ độ RE-001' })).toHaveValue(/^10\.03/);
  await page.getByRole('spinbutton', { name: 'Vĩ độ RE-001' }).fill('10.1');
  await page.getByRole('spinbutton', { name: 'Vĩ độ RE-001' }).blur();
  await page.getByRole('button', { name: 'Đặt lại vị trí mặc định' }).click();
  const dialog = page.getByRole('dialog', { name: 'Đặt lại vị trí mặc định?' });
  await expect(dialog).toContainText('khu vực Cần Thơ');
  await dialog.getByRole('button', { name: 'Đặt lại' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Vĩ độ RE-001' })).toHaveValue(/^10\.03/);
});

test.describe('a phone in another city', () => {
  test.use({ geolocation: { latitude: 21.0285, longitude: 105.8542 }, permissions: ['geolocation'] });

  test('offers to move the demo stations to the city the GPS is in', async ({ page }) => {
    await mockMapServices(page);
    await page.goto('/#driver-map');
    await page.getByRole('button', { name: 'Lấy GPS' }).click();
    await expect(page.getByText(/Xe đang cách phạm vi thu gom \d+ km/)).toBeVisible();
    await page.getByRole('button', { name: 'Chuyển sang Hà Nội' }).click();
    await expect(page.getByRole('combobox', { name: 'Khu vực minh họa' })).toHaveValue('hn');
    await expect(page.getByText(/Xe đang cách phạm vi thu gom/)).toHaveCount(0);
    // The truck stays where the GPS put it.
    await expect(page.getByText('Vị trí cuối 21.02850, 105.85420')).toBeVisible();
  });
});

test('on a phone the area strip under the search opens the same picker', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Trạm gần bạn: TP\.HCM · minh họa/ }).click();
  await page.getByRole('dialog', { name: 'Chọn khu vực' }).getByRole('button', { name: 'Cần Thơ' }).click();
  await expect(page.getByRole('button', { name: /Trạm gần bạn: Cần Thơ · minh họa/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
