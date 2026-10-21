import { useEffect, useState } from 'react';
import { useAppState } from '../../lib/store-context';
import { useFleetLive } from '../../lib/fleet-hooks';
import { clockTime, minutes, driverLink, fleetRequest, optimizeFleet, positionState, type DriverLink, type FleetPlan, type FleetSnapshot, type FleetVehicle } from '../../integrations/fleet';
import { Alert, Button, Dialog, TextField, toast } from '../../components/ui';
import { FleetMap } from '../../components/FleetMap';
import { PageHeader, Panel } from './shared';

const SESSION_KEY = 're-fleet-operator';
const VEHICLES_KEY = 're-fleet-vehicles';
const makeVehicle = (i: number): FleetVehicle => ({ id: `XE-${String(i).padStart(2, '0')}`, driver: `Tài xế ${i}`, payloadKg: 500, volumeM3: 2, start: 480, end: 1020 });
function readVehicles(): FleetVehicle[] {
  try { const v = JSON.parse(localStorage.getItem(VEHICLES_KEY) ?? 'null'); if (Array.isArray(v) && v.length && v.length <= 10 && v.every(x => x.id && x.driver && Number.isFinite(x.start) && Number.isFinite(x.end) && x.payloadKg > 0 && x.volumeM3 > 0)) return v; } catch { /* defaults */ }
  return [makeVehicle(1), makeVehicle(2)];
}

export function Fleet() {
  const state = useAppState();
  const [key, setKey] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? '');
  const [enteredKey, setEnteredKey] = useState('');
  const [autoConnect, setAutoConnect] = useState(true);
  const [vehicles, setVehicles] = useState(readVehicles);
  const [serviceMin, setServiceMin] = useState(8), [nextHours, setNextHours] = useState(12);
  const [includeNearby, setIncludeNearby] = useState(true);
  const [bans, setBans] = useState<{ start: number; end: number }[]>([]);
  const [plan, setPlan] = useState<FleetPlan | null>(null);
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const [links, setLinks] = useState<DriverLink[]>([]), [selected, setSelected] = useState('');
  const [endOpen, setEndOpen] = useState(false);
  const { fleet, setFleet, connection, now } = useFleetLive(key);
  const [view, setView] = useState<'setup' | 'live'>('setup');
  useEffect(() => {
    if (plan?.feasible && view === 'setup') document.getElementById('fleet-result')?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [plan]);
  const remember = (value: string) => { sessionStorage.setItem(SESSION_KEY, value); setKey(value); };
  useEffect(() => { localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles)); setPlan(null); }, [vehicles, serviceMin, nextHours, includeNearby, bans, state]);
  useEffect(() => {
    if (key || !autoConnect) return;
    let active = true;
    fleetRequest<{ key: string }>('/dev-session', '', {}).then((r) => { if (active) remember(r.key); }).catch(() => {});
    return () => { active = false; };
  }, [key, autoConnect]);
  const run = async (label: string, action: () => Promise<void>) => {
    setError(''); setBusy(label);
    try { await action(); } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  const edit = (i: number, patch: Partial<FleetVehicle>) => setVehicles((old) => old.map((v, n) => n === i ? { ...v, ...patch } : v));
  const shown = view === 'live' ? fleet?.plan : plan;
  const active = fleet?.plan?.routes.some(r => r.status !== 'done');
  const connected = connection === 'Đã kết nối trực tiếp';
  const inputClass = 'field w-full min-w-0 rounded border border-line bg-paper px-3 py-2 text-sm';
  const labelClass = 'flex min-w-0 flex-col gap-1 text-xs font-medium text-ink-2';
  return <>
    <PageHeader title="Đội xe & vị trí trực tiếp" sub="Chia trạm cho từng xe, giao tuyến và theo dõi chuyến thu gom."
      actions={<span role="status" className={`rounded-full px-3 py-1.5 text-xs font-medium ${connected ? 'bg-forest-tint text-forest-ink' : 'bg-amber-tint text-amber-ink'}`}>{connection}</span>} />
    {error && <div className="mb-4"><Alert tone="stop" title="Chưa hoàn tất thao tác">{error}</Alert></div>}
    {!key ? <Panel title="Kết nối đơn vị vận hành"><form className="max-w-lg space-y-4" onSubmit={e => { e.preventDefault(); void run('Kết nối…', async () => { await fleetRequest('/fleet', enteredKey); remember(enteredKey); setEnteredKey(''); }); }}>
      <p className="text-sm text-muted">Nhập khóa do quản trị viên cung cấp. Trên máy phát triển, dịch vụ có thể cho phép kết nối tự động.</p>
      <TextField id="fleet-key" label="Khóa điều phối" type="password" value={enteredKey} onChange={setEnteredKey} />
      <Button type="submit" variant="primary" disabled={!!busy || !enteredKey}>{busy || 'Kết nối đội xe'}</Button>
    </form></Panel> : <>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Chế độ đội xe">
        <button className={`btn ${view === 'setup' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={view === 'setup'} onClick={() => setView('setup')}>Lập kế hoạch</button>
        <button className={`btn ${view === 'live' ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={view === 'live'} onClick={() => setView('live')}>Theo dõi {fleet?.plan ? `· ${fleet.plan.routes.length} xe` : ''}</button>
        <button className="ml-auto text-xs underline" onClick={() => { setAutoConnect(false); sessionStorage.removeItem(SESSION_KEY); setKey(''); setLinks([]); }}>Đổi khóa kết nối</button>
      </div>
      {view === 'setup' && <form onSubmit={e => { e.preventDefault(); void run('Đang tìm đường và chia tuyến…', async () => {
        setPlan(null); const result = await optimizeFleet(state, vehicles, key, { serviceMin, nextHours, includeNearby, drivingBans: bans }); setPlan(result);
      }); }} className="space-y-4"><fieldset disabled={!!busy}>
        <Panel title={`${vehicles.length} xe sẵn sàng`} actions={<Button size="sm" disabled={vehicles.length >= 10 || !!busy} onClick={() => { let n = 1; while (vehicles.some(v => v.id === makeVehicle(n).id)) n++; setVehicles([...vehicles, makeVehicle(n)]); }}>Thêm xe</Button>}>
          <div className="grid gap-4 lg:grid-cols-2">{vehicles.map((v, i) => <fieldset key={v.id} className="rounded-lg border border-line p-4">
            <legend className="px-2 font-semibold text-forest-ink">{v.id}</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className={`${labelClass} col-span-2`}>Tài xế<input className={inputClass} required maxLength={80} value={v.driver} onChange={e => edit(i, { driver: e.target.value })} /></label>
              <label className={labelClass}>Tải trọng (kg)<input className={inputClass} type="number" required min="1" max="1000" value={v.payloadKg} onChange={e => edit(i, { payloadKg: Number(e.target.value) })} /></label>
              <label className={labelClass}>Thể tích (m³)<input className={inputClass} type="number" required min="0.01" max="20" step="0.01" value={v.volumeM3} onChange={e => edit(i, { volumeM3: Number(e.target.value) })} /></label>
              <label className={labelClass}>Bắt đầu ca<input className={inputClass} type="time" required value={clockTime(v.start)} onChange={e => edit(i, { start: minutes(e.target.value) })} /></label>
              <label className={labelClass}>Kết thúc ca<input className={inputClass} type="time" required value={clockTime(v.end)} onChange={e => edit(i, { end: minutes(e.target.value) })} /></label>
            </div>
            <div className="mt-3 flex items-center justify-between"><span className="text-xs text-muted">Xe tải nhỏ · tối đa 1 tấn</span><Button size="sm" disabled={vehicles.length <= 1 || !!busy} onClick={() => setVehicles(vehicles.filter((_, n) => n !== i))}>Bỏ {v.id}</Button></div>
          </fieldset>)}</div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Thay thùng mỗi trạm (phút)<input className={inputClass} required type="number" min="1" max="120" value={serviceMin} onChange={e => setServiceMin(Number(e.target.value))} /></label>
            <label className={labelClass}>Chuyến tiếp theo sau (giờ)<input className={inputClass} required type="number" min="1" max="72" value={nextHours} onChange={e => setNextHours(Number(e.target.value))} /></label>
          </div>
          <label className="my-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={includeNearby} onChange={e => setIncludeNearby(e.target.checked)} />Ghé thêm trạm đầy 50–60% nếu đủ tải và gần tuyến (ngưỡng chi phí ghé thêm 2 km).</label>
          <details className="rounded border border-line p-3"><summary className="cursor-pointer text-sm font-medium">Khoảng cấm chạy xe · {bans.length} khoảng</summary>
            <p className="my-3 text-xs text-muted">Nhập khoảng giờ áp dụng cho tất cả xe. Xe sẽ chờ trước khi chạy; lịch trong cùng ngày, giờ Việt Nam.</p>
            {bans.map((b, i) => <div key={i} className="mb-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <label className={labelClass}>Từ<input type="time" required className={inputClass} value={clockTime(b.start)} onChange={e => setBans(bans.map((x, j) => j === i ? { ...x, start: minutes(e.target.value) } : x))} /></label>
              <label className={labelClass}>Đến<input type="time" required className={inputClass} value={clockTime(b.end)} onChange={e => setBans(bans.map((x, j) => j === i ? { ...x, end: minutes(e.target.value) } : x))} /></label>
              <Button size="sm" onClick={() => setBans(bans.filter((_, j) => i !== j))}>Bỏ</Button>
            </div>)}<Button size="sm" disabled={bans.length >= 4} onClick={() => setBans([...bans, { start: 660, end: 780 }])}>Thêm khoảng cấm</Button>
          </details>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-xl text-xs text-muted">Trạm ≥{state.settings.warnPct}% hoặc dự báo đạt ngưỡng phải được ghé. Ưu tiên sớm trạm ≥{state.settings.stopPct}%. Kết thúc tại {state.settings.partner.name}. Khối lượng trạm hiện là dữ liệu demo.</p>
            <Button type="submit" variant="primary" icon="route" disabled={!!busy || !connected}>{busy || 'Tối ưu nhiều xe'}</Button></div>
        </Panel>
      </fieldset></form>}
      {view === 'live' && !fleet?.plan && <Panel title="Chưa có đợt điều phối"><p className="text-sm text-muted">Lập kế hoạch, kiểm tra phương án rồi giao tuyến để các tài xế nhận trên điện thoại.</p></Panel>}
      {shown && !shown.feasible && <div className="mt-4"><Alert tone="stop" title="Chưa tìm được phương án hợp lệ">{shown.message}</Alert></div>}
      {shown?.feasible && <div id="fleet-result" className="mt-5 scroll-mt-20 space-y-4">
        <Panel title={view === 'live' ? 'Các chuyến đã giao' : 'Phương án đề xuất'} actions={view === 'setup' ? <Button variant="primary" disabled={!!busy || !shown.routes.length || shown.provider === 'estimate' || !fleet || active || !connected} onClick={() => void run('Đang giao tuyến…', async () => {
          const res = await fleetRequest<{ fleet: FleetSnapshot; links: DriverLink[] }>('/dispatch', key, { planId: shown.planId, revision: fleet!.revision });
          setFleet(res.fleet); setLinks(res.links); setView('live'); setPlan(null); toast('Đã giao tuyến cho đội xe.');
        })}>Giao tuyến cho {shown.routes.length} xe</Button> : active ? <Button onClick={() => setEndOpen(true)} disabled={!!busy}>Kết thúc đợt điều phối</Button> : <span className="text-sm text-forest-ink">Đã kết thúc</span>}>
          <div className="mb-4 grid grid-cols-3 gap-3 border-b border-line pb-4">{[
            [shown.routes.length, 'xe được sử dụng'], [shown.routes.reduce((n, r) => n + r.stops.length, 0), 'trạm thu gom'], [shown.routes.reduce((n, r) => n + r.distanceKm, 0).toFixed(1), 'km cả đội'],
          ].map(([n, label]) => <div key={label}><p className="text-2xl font-semibold tabular-nums text-forest-ink">{n}</p><p className="text-xs text-muted">{label}</p></div>)}</div>
          {shown.provider !== 'valhalla' && <p className="mb-3 text-sm text-amber-ink">{shown.provider === 'estimate' ? 'Chỉ là ước tính đường thẳng. Kết nối lại dịch vụ bản đồ trước khi giao tuyến.' : 'Dữ liệu đường cho ô tô. Cần kiểm tra giới hạn xe tải trên tuyến trước khi chạy.'}</p>}
          {view === 'setup' && active && <p className="mb-3 text-sm text-amber-ink">Đội xe còn chuyến hoạt động. Kết thúc đợt hiện tại trước khi giao phương án mới.</p>}
          {shown.routes.length ? <FleetMap plan={shown} positions={view === 'live' ? fleet?.positions : {}} selected={selected} now={now} /> : <p>Không có trạm cần ghé trong đợt này.</p>}
          <p className="mt-3 text-xs text-muted">OR-Tools tìm phương án khả thi trong giới hạn thời gian. {shown.unserved.length > 0 && `Chưa ghé: ${shown.unserved.join(', ')}.`}</p>
        </Panel>
        <div className="grid gap-4 lg:grid-cols-2">{shown.routes.map((r) => {
          const p = view === 'live' ? fleet?.positions[r.vehicle.id] : undefined;
          const link = links.find(l => l.vehicleId === r.vehicle.id);
          return <Panel key={r.vehicle.id} title={<span>{r.vehicle.id} <span className="ml-2 font-normal text-muted">{r.vehicle.driver}</span></span>} actions={<Button size="sm" onClick={() => setSelected(r.vehicle.id)}>Xem trên bản đồ</Button>}>
            <div className="mb-3 flex flex-wrap gap-2 text-xs"><span className="rounded bg-sunk px-2 py-1">{r.loadKg.toFixed(1)} / {r.vehicle.payloadKg} kg</span><span className="rounded bg-sunk px-2 py-1">{r.volumeM3.toFixed(2)} / {r.vehicle.volumeM3} m³</span><span className="rounded bg-sunk px-2 py-1">{r.distanceKm.toFixed(1)} km</span></div>
            {view === 'live' && <div className="mb-4 rounded bg-sunk p-3"><p className="text-sm font-medium">{r.status === 'done' ? 'Chuyến đã kết thúc' : !connected ? 'Chưa xác nhận kết nối trực tiếp' : positionState(p, now)}</p>
              {p && <p className="mt-1 text-xs text-muted">Vị trí cuối cách đây {Math.max(0, Math.floor((now - p.recordedAt) / 1000))} giây · sai số ±{Math.round(p.accuracy)} m</p>}</div>}
            <ol className="space-y-3 border-l-2 border-forest-tint pl-4">{r.stops.map((s, i) => <li key={s.id} className="text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{i + 1}. {s.id} {s.status === 'done' ? '✓' : ''}</span><span className="tabular-nums text-muted">{clockTime(s.etaMin)}</span></div><p className="text-xs text-muted">{s.name} · {Math.round(s.fillPct)}%{s.cls === 'priority' ? ' · Ưu tiên' : ''}</p></li>)}</ol>
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">Về điểm tiếp nhận lúc {clockTime(r.endMin)} · ca {clockTime(r.vehicle.start)}–{clockTime(r.vehicle.end)}</p>
            {view === 'live' && r.status !== 'done' && <div className="mt-4 space-y-3">
              {link ? <><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void run('Đang sao chép…', async () => { await navigator.clipboard.writeText(driverLink(link.token)); toast(`Đã sao chép liên kết ${r.vehicle.id}.`); })}>Sao chép liên kết tài xế</Button><a className="btn btn-secondary btn-sm" href={driverLink(link.token)} target="_blank" rel="noreferrer">Mở màn hình tài xế</a></div><p className="text-xs text-muted">Liên kết riêng có hiệu lực 24 giờ. Chỉ chia sẻ cho tài xế của xe này.</p></> : <Button size="sm" disabled={!!busy} onClick={() => void run('Đang tạo liên kết…', async () => { const l = await fleetRequest<DriverLink>(`/vehicles/${r.vehicle.id}/link`, key, {}); setLinks(old => [...old.filter(x => x.vehicleId !== l.vehicleId), l]); })}>Cấp liên kết mới · thu hồi liên kết cũ</Button>}
            </div>}
          </Panel>;
        })}</div>
        {view === 'live' && <p className="text-xs text-muted">Giữ trang tài xế mở để gửi GPS; báo mất tín hiệu sau 30 giây. Điện thoại cần truy cập cùng địa chỉ HTTPS của hệ thống. Bản chạy localhost chỉ dùng trên máy này.</p>}
      </div>}
    </>}
    <Dialog open={endOpen} onClose={() => setEndOpen(false)} title="Kết thúc đợt điều phối?" footer={<><Button onClick={() => setEndOpen(false)}>Giữ các chuyến</Button><Button variant="danger" disabled={!!busy} onClick={() => void run('Đang kết thúc…', async () => { const data = await fleetRequest<FleetSnapshot>('/fleet/end', key, {}); setFleet(data); setLinks([]); setEndOpen(false); })}>Kết thúc và thu hồi liên kết</Button></>}>
      <p>Ngừng nhận GPS, xóa các vị trí đang lưu và thu hồi liên kết của tất cả tài xế trong đợt này. Các điểm chưa hoàn thành sẽ giữ nguyên để bạn kiểm tra.</p>
    </Dialog>
  </>;
}
