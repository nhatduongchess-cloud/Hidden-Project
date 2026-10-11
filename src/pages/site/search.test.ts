import { describe, expect, it } from 'vitest';
import { fold, searchSite, siteEntries, type SearchEntry } from './search';

const ENTRIES: SearchEntry[] = [
  { kind: 'page', title: 'Thí điểm và lộ trình', detail: 'Kinh tế thí điểm 3 trạm', href: '#pilot' },
  { kind: 'part', title: 'Rulo cán dẹt', detail: 'Hai rulo có răng', href: '#explorer-flatten' },
  { kind: 'station', title: 'RE-003 · Thư viện trung tâm', detail: 'Khu thư viện', href: '#hub-station-RE-003' },
  { kind: 'page', title: 'Tìm trạm', detail: 'Ứng dụng trả chai', href: '#app-stations', keywords: 'rulo' },
];

describe('fold', () => {
  it('drops Vietnamese marks and case so people can type without diacritics', () => {
    expect(fold('Rulo CÁN dẹt')).toBe('rulo can det');
    expect(fold('Đường  Đại Học')).toBe('duong dai hoc');
  });
});

describe('searchSite', () => {
  it('finds a part typed without diacritics', () => {
    expect(searchSite(ENTRIES, 'can det').map((e) => e.href)).toEqual(['#explorer-flatten']);
  });

  it('needs every word to match', () => {
    expect(searchSite(ENTRIES, 'thu vien')).toHaveLength(1);
    expect(searchSite(ENTRIES, 'thu vien rulo')).toHaveLength(0);
  });

  it('ranks title matches before keyword-only matches', () => {
    expect(searchSite(ENTRIES, 'rulo').map((e) => e.href)).toEqual(['#explorer-flatten', '#app-stations']);
  });

  it('limits results to the chosen scope', () => {
    expect(searchSite(ENTRIES, 'tr', 'station').map((e) => e.kind)).toEqual(['station']);
    expect(searchSite(ENTRIES, 'tr', 'page').every((e) => e.kind === 'page')).toBe(true);
  });

  it('returns nothing for an empty query', () => {
    expect(searchSite(ENTRIES, '   ')).toEqual([]);
  });
});

describe('siteEntries', () => {
  it('lists pages, every station and every station part, each with a link', () => {
    const all = siteEntries([{ id: 'RE-001', name: 'Sảnh nhà học A', site: 'Khu giảng đường' }], [{ id: 'bin', name: 'Thùng chứa tháo rời', summary: 'Một thùng xe đẩy' }]);
    expect(all.find((e) => e.kind === 'station')).toMatchObject({ title: 'RE-001 · Sảnh nhà học A', href: '#hub-station-RE-001' });
    expect(all.find((e) => e.kind === 'part')).toMatchObject({ title: 'Thùng chứa tháo rời', href: '#explorer-bin' });
    expect(all.filter((e) => e.kind === 'page').length).toBeGreaterThan(8);
    expect(all.every((e) => e.href.startsWith('#'))).toBe(true);
  });

  it('finds stations by the word "trạm" even though their names do not contain it', () => {
    const all = siteEntries([{ id: 'RE-001', name: 'Sảnh nhà học A', site: 'Khu giảng đường' }], []);
    expect(searchSite(all, 'tram', 'station').map((e) => e.title)).toEqual(['RE-001 · Sảnh nhà học A']);
  });
});
