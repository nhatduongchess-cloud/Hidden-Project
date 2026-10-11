import type { Totals } from '../../domain/selectors';

export interface ReportArgs {
  title: string;
  period: string;
  filters: string;
  units: string;
  disclaimer: string;
  generated: string;
  role: string;
  totals: Totals;
  stations: ({ id: string } & Totals)[];
  batches: {
    id: string;
    status: string;
    stations: string;
    est: number;
    measured: number | null;
    disc: number | null;
    discPct: number | null;
    evidence: string;
    downstream: number | null;
  }[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const f = (v: number, d: number) => v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Standalone printable HTML report with the same figures as the on-screen report. */
export function buildReportHtml(a: ReportArgs): string {
  const rows = a.batches
    .map(
      (b) =>
        `<tr><td>${esc(b.id)}</td><td>${esc(b.status)}</td><td>${esc(b.stations)}</td><td class=n>${f(b.est, 3)}</td><td class=n>${b.measured === null ? '—' : f(b.measured, 3)}</td><td class=n>${b.disc === null ? '—' : `${f(b.disc, 3)} (${f(b.discPct ?? 0, 1)} %)`}</td><td class=n>${b.downstream === null ? 'Chưa có' : f(b.downstream, 3)}</td><td>${esc(b.evidence)}</td></tr>`,
    )
    .join('');
  const st = a.stations
    .map((s) => `<tr><td>${esc(s.id)}</td><td class=n>${f(s.acceptedBottles, 0)}</td><td class=n>${f(s.acceptedKg, 3)}</td><td class=n>${f(s.rejected, 0)}</td></tr>`)
    .join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(a.title)}</title>
<style>body{font:13px/1.5 system-ui,sans-serif;color:#212321;margin:32px;max-width:960px}h1{font-size:20px;margin:0}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border-bottom:1px solid #d6d2c7;padding:4px 8px;text-align:left}th{background:#ece9e1}.n{text-align:right;font-variant-numeric:tabular-nums}.k{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.k div{border-left:2px solid #1e563c;padding-left:8px}.d{border-top:1px solid #212321;padding-top:8px;font-weight:600}@media print{body{margin:12mm}}</style></head><body>
<p style="font:11px monospace;text-transform:uppercase;letter-spacing:.08em;color:#62655f">RE · ${esc(a.role)}</p>
<h1>${esc(a.title)}</h1>
<p><b>Kỳ báo cáo:</b> ${esc(a.period)}<br><b>Bộ lọc áp dụng:</b> ${esc(a.filters)}<br>${esc(a.units)}<br>Tạo lúc ${esc(a.generated)}</p>
<div class=k><div>Chai được nhận<br><b>${f(a.totals.acceptedBottles, 0)}</b></div><div>Khối lượng ước tính (kg)<br><b>${f(a.totals.acceptedKg, 3)}</b></div><div>Vật phẩm trả lại<br><b>${f(a.totals.rejected, 0)}</b></div><div>Tỷ lệ trả lại (%)<br><b>${f(a.totals.rejectionRatePct, 1)}</b></div></div>
<table><thead><tr><th>Trạm</th><th class=n>Chai nhận</th><th class=n>kg ước tính</th><th class=n>Trả lại</th></tr></thead><tbody>${st}</tbody></table>
<table><thead><tr><th>Lô</th><th>Trạng thái</th><th>Trạm nguồn</th><th class=n>Ước tính (kg)</th><th class=n>Cân tiếp nhận (kg)</th><th class=n>Chênh lệch (kg, %)</th><th class=n>Hạ nguồn xác nhận (kg)</th><th>Tình trạng tài liệu</th></tr></thead><tbody>${rows}</tbody></table>
<p class=d>${esc(a.disclaimer)}</p>
<p>Khối lượng ước tính, khối lượng cân và kết quả hạ nguồn được tách riêng. Chai đã thu gom không được tự động tính là đã tái chế.</p>
</body></html>`;
}
