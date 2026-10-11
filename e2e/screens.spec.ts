import { test } from '@playwright/test';
import { mockMapServices } from './roadMocks';

/**
 * Screenshots of the map screens for review. Skipped unless SCREENS is set to an output folder:
 *   SCREENS=/tmp/shots npx playwright test screens
 * Base tiles are replaced by a blank grid (the test browser never calls the real map services).
 */
const OUT = process.env.SCREENS;
test.skip(!OUT, 'set SCREENS=<folder> to capture screenshots');

const SIZES = [
  { name: '390', width: 390, height: 844 },
  { name: '834', width: 834, height: 1112 },
  { name: '1440', width: 1440, height: 900 },
];

for (const s of SIZES) {
  test(`map screens at ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await mockMapServices(page);
    await page.goto('/#driver-map');
    await page.getByText('Nhanh nhất từ vị trí xe').waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/driver-map-${s.name}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Dẫn đường tới RE-003' }).click();
    await page.getByRole('button', { name: 'Bắt đầu', exact: true }).waitFor();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/nav-overview-${s.name}.png` });
    await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
    await page.getByRole('button', { name: 'Tới chỗ rẽ' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: 'Tạm dừng' }).click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/nav-driving-${s.name}.png` });
  });

  test(`hub screens at ${s.name}`, async ({ page }) => {
    await page.setViewportSize({ width: s.width, height: s.height });
    await mockMapServices(page);
    await page.goto('/#hub-routes');
    await page.getByText(/Tuyến khả thi/).waitFor();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/hub-routes-${s.name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Giao tuyến cho tài xế' }).click();
    await page.goto('/#driver');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/driver-assigned-${s.name}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Bắt đầu tuyến' }).click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/driver-stop-${s.name}.png`, fullPage: true });
    await page.goto('/#hub-settings');
    await page.getByRole('heading', { name: 'Vị trí trên bản đồ' }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/hub-settings-${s.name}.png`, fullPage: true });
  });
}
