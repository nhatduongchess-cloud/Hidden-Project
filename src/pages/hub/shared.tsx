import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import type { AppState, WorkOrder, WorkReason } from '../../domain/types';
import { stationOps, type AttentionItem, type AttentionKind, type OpStatus, type StationOps } from '../../domain/ops';
import { DEPOT, PARTNER } from '../../domain/routing';
import { navigate } from '../../lib/router';
import { saveFile } from '../../lib/download';
import { ago, dateTime, hours, n0 } from '../../lib/format';
import { Icon, type IconName } from '../../components/icons';
import { Alert, Button, Dialog, SelectField, toast } from '../../components/ui';

/* ---------- Hub-wide filters ---------- */

export type Period = 'today' | '7d' | '14d' | '30d';
export const PERIODS: { value: Period; label: string; days: number }[] = [
  { value: 'today', label: 'Hôm nay', days: 1 },
  { value: '7d', label: '7 ngày', days: 7 },
  { value: '14d', label: '14 ngày', days: 14 },
  { value: '30d', label: '30 ngày', days: 30 },
];
export function periodStart(p: Period, now = Date.now()): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - (PERIODS.find((x) => x.value === p)!.days - 1) * 86_400_000;
}

interface HubFilter {
  period: Period;
  setPeriod: (p: Period) => void;
  stationId: string;
  setStationId: (s: string) => void;
}
const FilterCtx = createContext<HubFilter | null>(null);
export function HubFilterProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<Period>('7d');
  const [stationId, setStationId] = useState('all');
  return <FilterCtx.Provider value={{ period, setPeriod, stationId, setStationId }}>{children}</FilterCtx.Provider>;
}
export function useHubFilter(): HubFilter {
  const c = useContext(FilterCtx);
  if (!c) throw new Error('HubFilterProvider missing');
  return c;
}

export function FilterBar({ station = true }: { station?: boolean }) {
  const state = useAppState();
  const f = useHubFilter();
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-[136px]">
        <SelectField id="hub-period" label="Khoảng thời gian" hideLabel value={f.period} onChange={f.setPeriod} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
      </div>
      {station && (
        <div className="w-[180px]">
          <SelectField
            id="hub-station-filter"
            label="Trạm"
            hideLabel
            value={f.stationId}
            onChange={f.setStationId}
            options={[{ value: 'all', label: 'Tất cả trạm' }, ...state.stations.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))]}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Page chrome ---------- */

export function PageHeader({ title, sub, actions, back }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back && (
          <a href={back.href} className="mb-1.5 inline-flex min-h-[32px] items-center gap-1 text-sm font-medium text-muted hover:text-ink">
            <Icon name="chevronLeft" size={16} />
            {back.label}
          </a>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-ink md:text-2xl">{title}</h1>
        {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className = '', pad = true, id }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section className={`card min-w-0 ${className}`} aria-labelledby={id}>
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 id={id} className="text-sm font-semibold text-ink">
            {title}
          </h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export async function offerFile(name: string, data: string, mime: string) {
  const r = await saveFile(name, data, mime);
  toast(r === 'saved' ? `Đã tạo tệp ${name}.` : r === 'declined' ? 'Đã hủy lưu tệp.' : 'Không lưu được tệp ở chế độ xem này.', r === 'saved' ? 'success' : 'warn');
}

/* ---------- Attention language ---------- */

export const ATTN: Record<AttentionKind, { icon: IconName; title: (o: StationOps) => string; why: (o: StationOps, s: AppState) => string }> = {
  estop: {
    icon: 'stop',
    title: () => 'Dừng khẩn cấp',
    why: () => 'Nút dừng khẩn cấp đang kích hoạt. Trạm không nhận chai cho đến khi kỹ thuật viên kiểm tra và đặt lại.',
  },
  jam: {
    icon: 'stop',
    title: () => 'Kẹt rulo',
    why: () => 'Rulo bị kẹt nên trạm ngừng xử lý. Chai đang kẹt không được tính điểm.',
  },
  full: {
    icon: 'stop',
    title: (o) => `Đã dừng nhận · ${Math.round(o.hubFillPct)} %`,
    why: (o) => `Thùng vượt ngưỡng 95 %. Ứng dụng đang hướng người dùng sang trạm khác. Thùng có ${n0(o.binBottles)} chai.`,
  },
  offline: {
    icon: 'wifiOff',
    title: (o) => `Mất kết nối · ${Math.round(o.minutesSinceReading)} phút`,
    why: (o) => `Trạm vẫn nhận chai và lưu tại chỗ. Mức đầy ${Math.round(o.hubFillPct)} % là số đo lúc ${dateTime(o.lastReadingTs).slice(6)}; thực tế có thể cao hơn.`,
  },
  warning: {
    icon: 'alert',
    title: (o) => `Cần thu gom · ${Math.round(o.hubFillPct)} %`,
    why: (o) => `Đã vượt 80 %. Ước tính chạm 95 % ${o.hoursTo95 === null ? 'chưa rõ' : `sau ${hours(o.hoursTo95).replace('≈ ', '')}`}.`,
  },
  forecast: {
    icon: 'clock',
    title: (o) => `Sắp đạt 80 % · ${Math.round(o.hubFillPct)} %`,
    why: (o) => `Ước tính chạm 80 % sau ${hours(o.hoursTo80).replace('≈ ', '')}, trước chuyến thu gom kế tiếp.`,
  },
};

export const SEVERITY_STYLE = {
  stop: { bar: 'bg-fault', icon: 'text-fault-ink', ring: 'bg-fault-tint', label: 'Dừng' },
  stale: { bar: 'bg-slate', icon: 'text-slate', ring: 'bg-slate-tint', label: 'Chưa rõ' },
  warn: { bar: 'bg-amber', icon: 'text-amber-ink', ring: 'bg-amber-tint', label: 'Cảnh báo' },
} as const;

export const REASON_LABEL: Record<WorkReason, string> = {
  full: 'Thùng đầy',
  warning: 'Vượt 80 %',
  forecast: 'Dự báo đạt 80 %',
  jam: 'Kẹt rulo',
  estop: 'Dừng khẩn cấp',
  offline: 'Mất kết nối',
  other: 'Khác',
};

export function kindNeeds(k: AttentionKind): 'collection' | 'maintenance' {
  return k === 'jam' || k === 'estop' || k === 'offline' ? 'maintenance' : 'collection';
}

export function taskStatusText(state: AppState, t: WorkOrder): string {
  if (t.status === 'done') return `Đã xong ${t.resolvedAt ? ago(t.resolvedAt) : ''}`.trim();
  if (t.kind === 'collection') {
    const r = t.routeId ? state.routes.find((x) => x.id === t.routeId) : undefined;
    if (r) return r.status === 'in_progress' ? `Trên tuyến ${r.id} · tài xế đang chạy` : `Trên tuyến ${r.id} · chờ tài xế bắt đầu`;
    return 'Đã tạo yêu cầu · chưa xếp tuyến';
  }
  return `Đã giao ${t.assignee ?? 'kỹ thuật viên'}${t.scheduledFor ? ` · ${dateTime(t.scheduledFor)}` : ''}`;
}

/* ---------- Work-order dialogs ---------- */

function reasonFromOps(o: StationOps): WorkReason {
  if (o.op === 'stopped') return 'full';
  if (o.op === 'warning') return 'warning';
  if (o.hoursTo80 !== null && o.hoursTo80 <= 12) return 'forecast';
  return 'other';
}

export function ScheduleCollectionDialog({ stationId, open, onClose }: { stationId: string; open: boolean; onClose: () => void }) {
  const state = useAppState();
  const store = useStore();
  const [mode, setMode] = useState<'route' | 'request'>('route');
  const st = state.stations.find((s) => s.id === stationId);
  if (!st) return null;
  const o = stationOps(state, st);
  const confirm = () => {
    const before = store.getState().tasks.length;
    store.dispatch({ type: 'CREATE_TASK', task: { stationId, kind: 'collection', reason: reasonFromOps(o), status: 'open', createdAt: Date.now() } });
    const t = store.getState().tasks[before];
    onClose();
    if (mode === 'route') {
      toast(`Đã tạo yêu cầu ${t?.id ?? ''}. Xem lại tuyến rồi giao cho tài xế.`);
      navigate('hub-routes');
    } else toast(`Đã tạo yêu cầu thu gom ${t?.id ?? ''} cho ${stationId}.`);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Lên lịch thu gom ${stationId}`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon={mode === 'route' ? 'route' : 'check'} onClick={confirm}>
            {mode === 'route' ? 'Tạo yêu cầu và lập tuyến' : 'Tạo yêu cầu'}
          </Button>
        </>
      }
    >
      <p>
        {st.name} · {o.stale ? 'lần đọc cuối' : 'hiện'} {Math.round(o.hubFillPct)} % · {n0(o.binBottles)} chai trong thùng.
      </p>
      <fieldset className="mt-3">
        <legend className="sr-only">Cách lên lịch</legend>
        {(
          [
            ['route', 'Lập tuyến ngay', 'RE Hub gợi ý tuyến gồm mọi trạm cần thu gom. Bạn xem lại trước khi giao cho tài xế.'],
            ['request', 'Chỉ tạo yêu cầu', 'Trạm vào danh sách chờ và được xếp ở lần lập tuyến tới.'],
          ] as const
        ).map(([v, l, h]) => (
          <label key={v} className={`mb-1.5 flex cursor-pointer gap-3 rounded border p-3 ${mode === v ? 'border-ink bg-white' : 'border-line'}`}>
            <input type="radio" name="sched-mode" className="mt-1 accent-[rgb(var(--c-forest))]" checked={mode === v} onChange={() => setMode(v)} />
            <span>
              <span className="block font-medium text-ink">{l}</span>
              <span className="block text-xs text-muted">{h}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </Dialog>
  );
}

const TECHS = ['Kỹ thuật viên demo 01', 'Kỹ thuật viên demo 02'];
const WHEN = [
  { value: '2h', label: 'Trong 2 giờ tới', ms: 2 * 3_600_000 },
  { value: 'today', label: 'Trong hôm nay', ms: 6 * 3_600_000 },
  { value: 'tomorrow', label: 'Ngày mai', ms: 24 * 3_600_000 },
] as const;

export function MaintenanceDialog({ stationId, reason, open, onClose }: { stationId: string; reason: WorkReason; open: boolean; onClose: () => void }) {
  const store = useStore();
  const [r, setR] = useState<WorkReason>(reason);
  const [tech, setTech] = useState(TECHS[0]);
  const [when, setWhen] = useState<(typeof WHEN)[number]['value']>('2h');
  const [note, setNote] = useState('');
  const confirm = () => {
    const now = Date.now();
    const before = store.getState().tasks.length;
    store.dispatch({
      type: 'CREATE_TASK',
      task: { stationId, kind: 'maintenance', reason: r, status: 'scheduled', createdAt: now, scheduledFor: now + WHEN.find((w) => w.value === when)!.ms, assignee: tech, note: note || undefined },
    });
    const t = store.getState().tasks[before];
    onClose();
    toast(`Đã giao ${t?.id ?? 'yêu cầu'} cho ${tech}.`);
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Yêu cầu bảo trì ${stationId}`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" icon="wrench" onClick={confirm}>
            Giao yêu cầu
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <SelectField
          id="mt-reason"
          label="Vấn đề"
          value={r}
          onChange={setR}
          options={(['jam', 'estop', 'offline', 'other'] as WorkReason[]).map((x) => ({ value: x, label: x === 'offline' ? 'Kiểm tra kết nối 4G' : REASON_LABEL[x] }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <SelectField id="mt-tech" label="Giao cho" value={tech} onChange={setTech} options={TECHS.map((x) => ({ value: x, label: x }))} />
          <SelectField id="mt-when" label="Thời hạn" value={when} onChange={setWhen} options={WHEN.map((w) => ({ value: w.value, label: w.label }))} />
        </div>
        <div>
          <label htmlFor="mt-note" className="field-label">
            Ghi chú cho kỹ thuật viên <span className="font-normal text-muted">(không bắt buộc)</span>
          </label>
          <textarea id="mt-note" rows={2} className="input min-h-[64px] py-2" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Dialog>
  );
}

const RESOLUTIONS: Record<string, string[]> = {
  jam: ['Đã gỡ kẹt và chạy thử 3 chai', 'Đã thay lưỡi rulo và chạy thử'],
  estop: ['Đã kiểm tra an toàn và nhả nút dừng', 'Nhấn nhầm, đã nhả nút dừng'],
  offline: ['Đã khởi động lại modem 4G', 'Nhà mạng khôi phục sóng'],
  other: ['Đã xử lý tại chỗ'],
};

export function ResolveDialog({ task, open, onClose }: { task: WorkOrder; open: boolean; onClose: () => void }) {
  const state = useAppState();
  const store = useStore();
  const opts = RESOLUTIONS[task.reason] ?? RESOLUTIONS.other;
  const [res, setRes] = useState(opts[0]);
  const st = state.stations.find((s) => s.id === task.stationId)!;
  const blocked = task.reason === 'offline' && st.connection !== 'online';
  const clears = task.kind === 'maintenance' && st.fault && (task.reason === st.fault || task.reason === 'other');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Xác nhận đã xử lý ${task.id}`}
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={blocked}
            onClick={() => {
              store.dispatch({ type: 'RESOLVE_TASK', taskId: task.id, ts: Date.now(), resolution: res });
              onClose();
              toast(clears ? `${st.id} đã sẵn sàng nhận chai.` : `Đã đóng ${task.id}.`);
            }}
          >
            Xác nhận đã xử lý
          </Button>
        </>
      }
    >
      {blocked ? (
        <Alert tone="stale" title="Chưa xác nhận được">
          {st.id} vẫn mất kết nối. RE Hub cần nhận lại tín hiệu từ trạm trước khi đóng yêu cầu này.
        </Alert>
      ) : (
        <>
          <p>
            {st.id} · {REASON_LABEL[task.reason]} · {task.assignee}
          </p>
          <SelectField id="res-pick" label="Kết quả xử lý" value={res} onChange={setRes} options={opts.map((o) => ({ value: o, label: o }))} />
          {clears && <p className="mt-2 text-xs text-muted">Xác nhận sẽ đặt trạm về trạng thái sẵn sàng.</p>}
        </>
      )}
    </Dialog>
  );
}

/* ---------- Event log language ---------- */

export function logText(text: string): string {
  const [k, a, b] = text.split(':');
  switch (k) {
    case 'warn_crossed':
      return 'Vượt 80 %: cần thu gom';
    case 'stop_reached':
      return 'Đạt 95 %: trạm dừng nhận chai';
    case 'fault_jam':
      return 'Kẹt rulo: trạm dừng xử lý';
    case 'fault_estop':
      return 'Nút dừng khẩn cấp được nhấn';
    case 'cleared_jam':
      return 'Đã gỡ kẹt, trạm sẵn sàng';
    case 'cleared_estop':
      return 'Đã nhả dừng khẩn cấp, trạm sẵn sàng';
    case 'conn_offline':
      return 'Mất kết nối, trạm lưu dữ liệu tại chỗ';
    case 'conn_online':
      return 'Kết nối khôi phục';
    case 'synced':
      return `Đồng bộ ${a} bản ghi${b && b !== '0' ? `, bỏ qua ${b} bản trùng` : ''}`;
    case 'collected':
      return `Đã thay thùng (${a} chai)`;
    default:
      return text;
  }
}
export function logTone(level: 'info' | 'warn' | 'error'): string {
  return level === 'error' ? 'bg-fault' : level === 'warn' ? 'bg-amber' : 'bg-line-strong';
}

/* ---------- Campus schematic ---------- */

const POS: Record<string, [number, number]> = { [DEPOT]: [5, 75], [PARTNER]: [95, 48] };
const BLOCKS: { x: number; y: number; w: number; h: number; label: string }[] = [
  { x: 14, y: 28, w: 26, h: 18, label: 'Khu giảng đường' },
  { x: 60, y: 12, w: 26, h: 20, label: 'Khu ký túc xá' },
  { x: 34, y: 58, w: 26, h: 16, label: 'Khu thư viện' },
];

function Marker({ o, x, y }: { o: StationOps; x: number; y: number }) {
  const op: OpStatus = o.op;
  const stale = o.stale;
  const fill = stale ? 'rgb(var(--c-slate))' : op === 'accepting' ? 'rgb(var(--c-forest))' : op === 'warning' ? 'rgb(var(--c-amber))' : 'rgb(var(--c-fault))';
  return (
    <g>
      {op === 'warning' ? (
        <path d={`M${x} ${y - 4} L${x + 4} ${y + 3} L${x - 4} ${y + 3} Z`} fill={fill} />
      ) : op === 'accepting' ? (
        <circle cx={x} cy={y} r={3.4} fill={fill} />
      ) : (
        <rect x={x - 3.2} y={y - 3.2} width={6.4} height={6.4} rx={0.6} fill={fill} />
      )}
      {op === 'accepting' && <path d={`M${x - 1.5} ${y} l1 1.1 l2 -2.2`} stroke="#fff" strokeWidth={0.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
      {op === 'warning' && <path d={`M${x} ${y - 1.2} v1.8 M${x} ${y + 1.8} v0.1`} stroke="#fff" strokeWidth={0.7} strokeLinecap="round" />}
      {op !== 'accepting' && op !== 'warning' && <rect x={x - 1.3} y={y - 1.3} width={2.6} height={2.6} fill="#fff" />}
      {stale && <circle cx={x} cy={y} r={5.6} fill="none" stroke="rgb(var(--c-slate))" strokeWidth={0.5} strokeDasharray="1.2 0.9" />}
    </g>
  );
}

/** Illustrative campus schematic. Positions are not real locations. Status uses shape + label, not colour alone. */
export function StationMap({
  route,
  baseline,
  selected,
  height,
  label = 'Sơ đồ khuôn viên minh họa',
}: {
  route?: string[];
  baseline?: string[];
  selected?: string;
  height?: number;
  label?: string;
}) {
  const state = useAppState();
  const pos = (id: string): [number, number] => POS[id] ?? (() => {
    const s = state.stations.find((x) => x.id === id)!;
    return [s.mapX, s.mapY] as [number, number];
  })();
  const showEnds = !!route;
  const order = route ? new Map(route.map((id, i) => [id, i])) : null;
  return (
    <svg viewBox="0 0 100 82" className="h-auto w-full" style={height ? { maxHeight: height } : undefined} role="img" aria-label={label}>
      <rect x="0" y="0" width="100" height="82" fill="rgb(var(--c-sunk) / 0.55)" rx="1.5" />
      <path d="M0 50 C 25 47, 40 52, 58 47 S 85 40, 100 42" stroke="rgb(var(--c-line-strong))" strokeWidth="2.4" fill="none" opacity="0.55" />
      <path d="M50 0 C 52 20, 46 34, 52 50 S 55 70, 52 82" stroke="rgb(var(--c-line-strong))" strokeWidth="1.6" fill="none" opacity="0.45" />
      {BLOCKS.map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="rgb(var(--c-panel))" stroke="rgb(var(--c-line-strong))" strokeWidth="0.3" rx="0.8" />
          <text x={b.x + 1.2} y={b.y + 3} fontSize="2.3" fill="rgb(var(--c-muted))" fontFamily="Be Vietnam Pro, sans-serif">
            {b.label}
          </text>
        </g>
      ))}
      {baseline && (
        <polyline points={baseline.map((id) => pos(id).join(',')).join(' ')} fill="none" stroke="rgb(var(--c-muted))" strokeWidth="0.5" strokeDasharray="1.6 1.2" />
      )}
      {route && <polyline points={route.map((id) => pos(id).join(',')).join(' ')} fill="none" stroke="rgb(var(--c-forest))" strokeWidth="0.9" strokeLinejoin="round" />}
      {showEnds &&
        [DEPOT, PARTNER].map((id) => (
          <g key={id}>
            <rect x={POS[id][0] - 2.2} y={POS[id][1] - 2.2} width="4.4" height="4.4" fill="rgb(var(--c-ink))" rx="0.5" />
            <text
              x={POS[id][0] + (id === PARTNER ? -3.2 : 3.2)}
              y={POS[id][1] + (id === PARTNER ? -3.6 : 1)}
              fontSize="2.6"
              textAnchor={id === PARTNER ? 'end' : 'start'}
              fill="rgb(var(--c-ink))"
              fontFamily="Be Vietnam Pro, sans-serif"
            >
              {id === PARTNER ? 'Đối tác tiếp nhận' : 'Kho RE'}
            </text>
          </g>
        ))}
      {state.stations.map((s) => {
        const o = stationOps(state, s);
        const [x, y] = [s.mapX, s.mapY];
        const idx = order?.get(s.id);
        const dim = order && idx === undefined;
        return (
          <a key={s.id} href={`#hub-station-${s.id}`} aria-label={`${s.id}, ${s.name}, mức đầy ${Math.round(o.hubFillPct)} %${o.stale ? ', số đo cũ' : ''}`}>
            <g opacity={dim ? 0.55 : 1}>
            {selected === s.id && <circle cx={x} cy={y} r={7.5} fill="none" stroke="rgb(var(--c-ink))" strokeWidth="0.5" />}
            <Marker o={o} x={x} y={y} />
            <g fontFamily="JetBrains Mono, monospace">
              <rect x={x + 5} y={y - 3.6} width={idx !== undefined ? 22 : 18} height={7.2} rx="0.8" fill="rgb(var(--c-panel))" stroke="rgb(var(--c-line))" strokeWidth="0.25" />
              <text x={x + 6.2} y={y - 0.6} fontSize="2.5" fontWeight="700" fill="rgb(var(--c-ink))">
                {idx !== undefined ? `${idx}. ` : ''}
                {s.id}
              </text>
              <text x={x + 6.2} y={y + 2.4} fontSize="2.3" fill={o.stale ? 'rgb(var(--c-slate))' : 'rgb(var(--c-ink-2))'}>
                {Math.round(o.hubFillPct)} %{o.stale ? ' · cũ' : ''}
              </text>
            </g>
            </g>
          </a>
        );
      })}
    </svg>
  );
}

export function MapLegend() {
  const items: { shape: ReactNode; label: string }[] = [
    { shape: <circle cx="6" cy="6" r="4.5" fill="rgb(var(--c-forest))" />, label: 'Đang nhận' },
    { shape: <path d="M6 1 L11 10 L1 10 Z" fill="rgb(var(--c-amber))" />, label: '≥ 80 %' },
    { shape: <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="rgb(var(--c-fault))" />, label: 'Dừng hoặc lỗi' },
    { shape: <circle cx="6" cy="6" r="4.5" fill="none" stroke="rgb(var(--c-slate))" strokeDasharray="2 1.5" />, label: 'Số đo cũ' },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            {i.shape}
          </svg>
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** One attention row's primary actions, derived from what the station needs and what already exists. */
export function useAttentionActions(item: AttentionItem) {
  const needs = [...new Set([item.kind, ...item.also].map(kindNeeds))];
  return needs;
}
