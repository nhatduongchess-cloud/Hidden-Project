/**
 * Site search for the store-style header: pages, stations and station parts, matched without
 * Vietnamese diacritics so "can det" finds "Rulo cán dẹt". Pure functions; the header builds the
 * index from live demo data each time the stations change.
 */
export type SearchScope = 'all' | 'station' | 'part' | 'page';

export interface SearchEntry {
  kind: Exclude<SearchScope, 'all'>;
  title: string;
  detail: string;
  href: string;
  /** Extra words that should find this entry but are not shown. */
  keywords?: string;
}

export const SCOPES: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'station', label: 'Trạm' },
  { value: 'part', label: 'Bộ phận trạm' },
  { value: 'page', label: 'Trang' },
];

export const KIND_LABEL: Record<SearchEntry['kind'], string> = { station: 'Trạm', part: 'Bộ phận trạm', page: 'Trang' };

export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchSite(entries: SearchEntry[], query: string, scope: SearchScope = 'all', limit = 8): SearchEntry[] {
  const q = fold(query);
  if (!q) return [];
  const words = q.split(' ');
  const ranked: { e: SearchEntry; rank: number; i: number }[] = [];
  entries.forEach((e, i) => {
    if (scope !== 'all' && e.kind !== scope) return;
    const title = fold(e.title);
    const hay = `${title} ${fold(e.detail)} ${fold(e.keywords ?? '')}`;
    if (!words.every((w) => hay.includes(w))) return;
    const rank = title.startsWith(q) ? 0 : words.every((w) => title.includes(w)) ? 1 : 2;
    ranked.push({ e, rank, i });
  });
  return ranked
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.e);
}

const PAGES: Omit<SearchEntry, 'kind'>[] = [
  { title: 'Giới thiệu RE', detail: 'Trang chủ', href: '#home', keywords: 'trang chu pcic de xuat' },
  { title: 'Bên trong trạm RE', detail: 'Khám phá trạm theo từng bộ phận', href: '#explorer', keywords: 'mat cat kich thuoc thong so' },
  { title: 'Thí điểm và lộ trình', detail: 'Kinh tế thí điểm 3 trạm', href: '#pilot', keywords: 'chi phi doanh thu hoa von lo trinh' },
  { title: 'Trả chai', detail: 'Ứng dụng trả chai', href: '#app-return', keywords: 'qr quet ma diem' },
  { title: 'Tìm trạm', detail: 'Ứng dụng trả chai', href: '#app-stations', keywords: 'gan ban ban do' },
  { title: 'Điểm thưởng', detail: 'Ứng dụng trả chai', href: '#app-rewards', keywords: 'uu dai doi diem' },
  { title: 'Lịch sử trả chai', detail: 'Ứng dụng trả chai', href: '#app-history', keywords: 'giao dich' },
  { title: 'Tuyến của tài xế', detail: 'Tài xế thu gom', href: '#driver', keywords: 'thay thung diem dung' },
  { title: 'Trạm gần nhất cho xe thu gom', detail: 'Tài xế thu gom · bản đồ', href: '#driver-map', keywords: 'dan duong ban do xe tai' },
  { title: 'Tổng quan RE Hub', detail: 'Vận hành', href: '#hub', keywords: 'can xu ly muc day' },
  { title: 'Tuyến thu gom', detail: 'RE Hub', href: '#hub-routes', keywords: 'lap tuyen ban do' },
  { title: 'Giao dịch', detail: 'RE Hub', href: '#hub-transactions', keywords: 'chai csv' },
  { title: 'Truy xuất và báo cáo', detail: 'RE Hub · nhãn hàng', href: '#hub-trace', keywords: 'epr lo phieu can nhan hang' },
  { title: 'Hệ thống thiết kế', detail: 'Màu, chữ, thành phần', href: '#design', keywords: 'design token' },
];

export function siteEntries(stations: { id: string; name: string; site: string }[], parts: { id: string; name: string; summary: string }[]): SearchEntry[] {
  return [
    ...stations.map((s): SearchEntry => ({ kind: 'station', title: `${s.id} · ${s.name}`, detail: s.site, href: `#hub-station-${s.id}`, keywords: 'trạm thu gom' })),
    ...parts.map((p): SearchEntry => ({ kind: 'part', title: p.name, detail: p.summary, href: `#explorer-${p.id}` })),
    ...PAGES.map((p): SearchEntry => ({ kind: 'page', ...p })),
  ];
}
