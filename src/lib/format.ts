const nf0 = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf3 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const n0 = (v: number) => nf0.format(v);
export const n1 = (v: number) => nf1.format(v);
export const n2 = (v: number) => nf2.format(v);
export const n3 = (v: number) => nf3.format(v);
export const kg = (v: number, d: 1 | 2 | 3 = 2) => `${d === 1 ? n1(v) : d === 2 ? n2(v) : n3(v)} kg`;
export const pct = (v: number) => `${n1(v)} %`;
/** Millions of VND, e.g. "38,5 tr đ" */
export const trd = (vnd: number) => `${n1(vnd / 1_000_000)} tr đ`;
export const vnd = (v: number) => `${n0(v)} đ`;

export function dateTime(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function dateOnly(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function isoDay(ts: number): string {
  const d = new Date(ts);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function ago(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s} giây trước`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} phút trước`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}
export function hours(h: number | null): string {
  if (h === null) return '—';
  if (h <= 0) return 'đã đạt';
  if (h < 1) return `≈ ${Math.max(1, Math.round(h * 60))} phút`;
  if (h < 48) return `≈ ${n1(h)} giờ`;
  return `≈ ${n1(h / 24)} ngày`;
}
