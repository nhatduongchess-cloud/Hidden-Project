import { expect, test, type Page } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { mockMapServices } from './roadMocks';

/**
 * A run against the real public map services (OpenStreetMap tiles, Valhalla, OSRM), with no mocks.
 * Skipped unless LIVE is set to an output folder for screenshots, a video and a summary:
 *   LIVE=./live-run npx playwright test live
 * Add PW_CHANNEL=msedge (or chrome) to use an installed browser instead of Playwright's own, and
 * BASE_URL=https://…/ to check a deployed copy instead of the local build.
 * Needs a network that can reach those services. LIVE_MOCK=1 rehearses the script on the test mocks.
 */
const OUT = process.env.LIVE;
test.skip(!OUT, 'set LIVE=<folder> to run against the real map services');
// LIVE_VIDEO=0 skips the video (it needs Playwright's ffmpeg: `npx playwright install ffmpeg`).
const VIDEO = process.env.LIVE_VIDEO !== '0';
test.use({ viewport: { width: 390, height: 844 }, video: VIDEO ? { mode: 'on', size: { width: 390, height: 844 } } : 'off' });

async function tilesLoaded(page: Page) {
  await expect.poll(() => page.locator('.leaflet-tile-loaded').count(), { timeout: 30_000 }).toBeGreaterThan(3);
  await expect(page.getByText('Không tải được bản đồ nền')).toHaveCount(0);
}

test('driver map and navigation on real streets', async ({ page }) => {
  test.setTimeout(180_000);
  const summary: Record<string, unknown> = { startedAt: new Date().toISOString() };
  const failures: string[] = [];
  if (process.env.LIVE_MOCK) await mockMapServices(page);
  page.on('requestfailed', (r) => failures.push(`${r.failure()?.errorText} ${r.url().slice(0, 100)}`));

  await page.goto('./#driver-map');
  await page.getByText('Nhanh nhất từ vị trí xe').waitFor({ timeout: 60_000 });
  await tilesLoaded(page);
  const provider = page.getByText(/^Đường thực tế ·|^Ước tính đường thẳng/).first();
  summary.mapProvider = await provider.innerText();
  summary.ranking = await page.getByRole('list', { name: 'Trạm cần thu gom, nhanh nhất trước' }).innerText();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/1-ban-do-tai-xe.png`, fullPage: true });

  await page.getByRole('link', { name: /^Dẫn đường tới RE-/ }).first().click();
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).waitFor({ timeout: 60_000 });
  await tilesLoaded(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/2-tong-quan-tuyen.png` });
  await page.getByRole('button', { name: 'Các bước' }).click();
  await page.waitForTimeout(500);
  summary.steps = await page.getByRole('dialog').innerText().catch(() => null);
  await page.screenshot({ path: `${OUT}/3-cac-buoc.png` });
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await page.getByRole('button', { name: '×5' }).click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/4-dang-chay.png` });
  summary.banner = await page.locator('[class*="bg-forest-ink"]').first().innerText();
  const skip = page.getByRole('button', { name: 'Tới chỗ rẽ' });
  for (let i = 0; i < 3 && (await skip.isVisible()); i++) {
    await skip.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/5-cho-re-${i + 1}.png` });
  }
  const fast = page.getByRole('button', { name: '×20' });
  if (await fast.isVisible()) await fast.click();
  await page.getByText('Đã đến nơi').waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/6-da-den-noi.png` });

  await page.goto('./#hub-routes');
  await page.getByText(/Tuyến khả thi/).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(4000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/7-re-hub-tuyen.png`, fullPage: true });
  summary.hubProvider = await page.getByText(/^Đường thực tế ·|^Ước tính đường thẳng/).first().innerText();

  summary.failedRequests = failures;
  summary.finishedAt = new Date().toISOString();
  writeFileSync(`${OUT}/summary.json`, JSON.stringify(summary, null, 2));
  await page.close();
  await page.video()?.saveAs(`${OUT}/chay-thu.webm`);
  expect(String(summary.mapProvider)).toMatch(/^Đường thực tế/);
});
