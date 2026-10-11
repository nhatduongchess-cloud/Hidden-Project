import { test, expect, type Page } from '@playwright/test';
import { mockMapServices } from './roadMocks';

/** The public website: store-style header, search, "Tất cả" menu, home cards and the station page. */
const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  await mockMapServices(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#home');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});
test.afterEach(() => expect(errors).toEqual([]));

const search = (page: Page) => page.getByRole('combobox', { name: 'Tìm trên RE' });

test('search without diacritics opens the station part', async ({ page }) => {
  await search(page).fill('can det');
  await expect(page.getByRole('option', { name: /Rulo cán dẹt/ })).toBeVisible();
  await search(page).press('Enter');
  await expect(page).toHaveURL(/#explorer-flatten$/);
  const parts = page.getByRole('list', { name: 'Bộ phận của trạm' });
  await expect(parts.getByRole('button', { name: /Rulo cán dẹt/ })).toHaveAttribute('aria-expanded', 'true');
});

test('search scoped to stations opens the station in RE Hub', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Phạm vi tìm kiếm' }).selectOption('station');
  await search(page).fill('thu vien');
  await page.getByRole('option', { name: /RE-003 · Thư viện trung tâm/ }).click();
  await expect(page).toHaveURL(/#hub-station-RE-003$/);
});

test('arrow keys move through suggestions and Escape closes them', async ({ page }) => {
  await search(page).fill('tram');
  const options = page.getByRole('listbox', { name: 'Gợi ý tìm kiếm' }).getByRole('option');
  await expect(options.first()).toBeVisible();
  await search(page).press('ArrowDown');
  await search(page).press('ArrowDown');
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await search(page).press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('a search with no match says so', async ({ page }) => {
  await search(page).fill('zzzz');
  await expect(page.getByText('Không tìm thấy kết quả cho “zzzz”')).toBeVisible();
});

test('the "Tất cả" menu lists every experience', async ({ page }) => {
  await page.getByRole('button', { name: 'Tất cả' }).click();
  const menu = page.getByRole('dialog', { name: 'Xin chào, Sinh viên demo 01' });
  await expect(menu).toBeVisible();
  await menu.getByRole('link', { name: 'Trạm gần nhất cho xe thu gom' }).click();
  await expect(page.getByRole('heading', { name: 'Trạm cần thu gom gần nhất' })).toBeVisible();
});

test('home shows live station status from the demo data', async ({ page }) => {
  const card = page.getByRole('region', { name: 'Trạm gần bạn' });
  await expect(card.getByRole('listitem')).toHaveCount(3);
  await expect(card.getByRole('listitem').filter({ hasText: 'RE-003' })).toContainText('Tạm ngừng nhận');
  await expect(card.getByRole('listitem').filter({ hasText: 'RE-002' })).toContainText('Chưa rõ tình trạng');
});

test('the header bottle count follows a return in the app', async ({ page }) => {
  const count = page.getByRole('link', { name: /chai đã trả/ });
  const before = Number((await count.getAttribute('aria-label'))!.match(/\d+/)![0]);
  await page.goto('/#app-return');
  await page.getByRole('button', { name: 'Dùng trạm RE-001' }).click();
  await page.getByRole('button', { name: 'Quét mã (mô phỏng)' }).click();
  await page.getByRole('button', { name: 'Đã đặt chai vào khe' }).click();
  await expect(page.getByText('Chai đã vào thùng. Điểm đã được cộng.')).toBeVisible();
  await page.goto('/#home');
  await expect(count).toHaveAttribute('aria-label', `${before + 1} chai đã trả`);
});

test('the home hero cycles through the station renders', async ({ page }) => {
  const hero = page.getByRole('region', { name: 'Ảnh trạm RE' });
  await expect(hero.getByText('1 / 3')).toBeVisible();
  await hero.getByRole('button', { name: 'Ảnh sau' }).click();
  await expect(hero.getByText('2 / 3')).toBeVisible();
  await hero.getByRole('button', { name: 'Ảnh trước' }).click();
  await hero.getByRole('button', { name: 'Ảnh trước' }).click();
  await expect(hero.getByText('3 / 3')).toBeVisible();
});

test('back to top returns to the top of the page', async ({ page }) => {
  await page.getByRole('button', { name: 'Lên đầu trang' }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

for (const hash of ['#home', '#explorer', '#pilot']) {
  test(`no sideways scrolling on a phone: ${hash}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${hash}`);
    await expect(search(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
