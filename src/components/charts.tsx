import { n1, n0 } from '../lib/format';

/** Daily bar chart with a faint grid and an emphasised latest bar. Drawn to one linear scale. */
export function DailyBars({ data, label, unit = 'kg' }: { data: { day: number; kg: number }[]; label: string; unit?: string }) {
  const W = 640;
  const Hh = 200;
  const pad = { l: 40, r: 10, t: 12, b: 28 };
  const max = Math.max(1, ...data.map((d) => d.kg));
  const step = max <= 2 ? 0.5 : max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (Hh - pad.t - pad.b) * (1 - v / top);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${Hh}`} className="h-auto w-full min-w-[420px]" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line))" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill="rgb(var(--c-muted))" fontFamily="Source Sans 3 Variable, monospace">
              {n1(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const last = i === data.length - 1;
          const x = pad.l + i * bw + bw * 0.18;
          const date = new Date(d.day);
          return (
            <g key={d.day}>
              <rect x={x} y={y(d.kg)} width={bw * 0.64} height={Math.max(0, y(0) - y(d.kg))} fill={last ? 'rgb(var(--c-forest))' : 'rgb(var(--c-forest) / 0.45)'} rx={1.5}>
                <title>{`${date.getDate()}/${date.getMonth() + 1}: ${n1(d.kg)} ${unit}`}</title>
              </rect>
              {(i % Math.max(1, Math.ceil(data.length / 8)) === 0 || last) && (
                <text x={x + bw * 0.32} y={Hh - 10} textAnchor="middle" fontSize={10} fill="rgb(var(--c-muted))" fontFamily="Source Sans 3 Variable, monospace">
                  {`${date.getDate()}/${date.getMonth() + 1}`}
                </text>
              )}
            </g>
          );
        })}
        <text x={pad.l} y={9} fontSize={10} fill="rgb(var(--c-muted))" fontFamily="Source Sans 3 Variable, monospace">
          {unit}
        </text>
      </svg>
    </div>
  );
}

/** Proportional horizontal breakdown with values in a table-like legend. */
export function Breakdown({ items, unit }: { items: { label: string; value: number; color: string }[]; unit: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-4 w-full overflow-hidden rounded-sm bg-sunk" aria-hidden>
        {items.map((i) => (
          <div key={i.label} style={{ width: total ? `${(i.value / total) * 100}%` : 0, background: i.color }} />
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {items.map((i) => (
            <tr key={i.label} className="border-b border-line/60 last:border-0">
              <td className="py-1.5 pr-2">
                <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: i.color }} />
                {i.label}
              </td>
              <td className="py-1.5 text-right tnum">
                {unit === 'kg' ? n1(i.value) : n0(i.value)} {unit}
              </td>
              <td className="w-16 py-1.5 text-right text-muted tnum">{total ? n0((i.value / total) * 100) : 0} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
