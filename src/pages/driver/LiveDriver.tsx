import { useEffect, useState } from 'react';
import { Button, Dialog } from '../../components/ui';
import { FleetMap } from '../../components/FleetMap';
import { clockTime, fleetRequest, FleetError, type DriverAssignment, type FleetPlan, type FleetStop } from '../../integrations/fleet';
import { useGpsSender } from '../../lib/fleet-hooks';

export function LiveDriver({ initialToken }: { initialToken?: string }) {
  const [token] = useState(() => initialToken ?? sessionStorage.getItem('re-fleet-driver') ?? '');
  const [data, setData] = useState<DriverAssignment | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [expired, setExpired] = useState(false);
  const [confirm, setConfirm] = useState<FleetStop | null>(null);
  const gps = useGpsSender(token);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (initialToken) {
      sessionStorage.setItem('re-fleet-driver', initialToken);
      // Keep the bearer credential out of copied URLs and browser address-bar screenshots.
      history.replaceState(null, '', `${location.pathname}${location.search}#driver-live`);
    }
  }, [initialToken]);
  useEffect(() => {
    if (!token) return;
    let active = true, pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try { const res = await fleetRequest<DriverAssignment>('/driver', token); if (active) { setData(res); setError(''); } }
      catch (e) { if (active) { setError((e as Error).message); if (e instanceof FleetError && e.status === 401) setExpired(true); } }
      finally { pending = false; }
    };
    void refresh(); const timer = setInterval(() => { setNow(Date.now()); void refresh(); }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);
  const done = data?.route.status === 'done';
  useEffect(() => { if (expired || done) void gps.stop(); }, [expired, done]); // stop only when the assignment closes
  const act = async (action: string, stationId?: string) => {
    setBusy(true); setError('');
    try {
      if (action === 'finish') await gps.stop();
      await fleetRequest('/driver/action', token, { action, ...(stationId ? { stationId } : {}) });
      setData(await fleetRequest<DriverAssignment>('/driver', token)); setConfirm(null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const plan: FleetPlan | null = data ? { feasible: true, routes: [data.route], depot: data.depot, destination: data.destination, provider: 'valhalla', unserved: [], message: '', id: data.route.vehicle.id } : null;
  const latest = gps.position ?? data?.position;
  return <main id="main" tabIndex={-1} className="min-h-screen bg-sunk px-3 py-5 outline-none">
    <div className="mx-auto max-w-xl space-y-4">
      <header className="rounded-lg bg-forest p-5 text-white"><p className="text-xs uppercase tracking-wider">RE · Chuyến thu gom</p><h1 className="mt-2 text-2xl font-semibold">{data ? data.route.vehicle.id : 'Tuyến được giao'}</h1><p className="mt-1 text-sm">{data ? `${data.route.vehicle.driver} · ${clockTime(data.route.vehicle.start)}–${clockTime(data.route.vehicle.end)}` : 'Nhận tuyến từ đơn vị vận hành'}</p></header>
      {!token && <div className="card p-5"><h2 className="font-semibold">Cần liên kết tài xế</h2><p className="mt-2 text-sm text-muted">Mở liên kết riêng do điều phối viên gửi để nhận đúng tuyến và bật chia sẻ vị trí.</p></div>}
      {(error || gps.error) && <div className="rounded border border-amber bg-amber-tint p-4 text-sm text-amber-ink" role="alert">{error || gps.error}</div>}
      {token && !data && !error && <p role="status">Đang nhận tuyến từ điều phối…</p>}
      {data && !expired && <>
        <section className="card p-5" aria-labelledby="sharing-title"><div className="flex items-center justify-between gap-3"><h2 id="sharing-title" className="font-semibold">Vị trí của xe</h2><span className="text-xs text-muted">{done ? 'Chuyến đã kết thúc' : gps.sharing ? 'Đã bật GPS' : 'Chưa chia sẻ'}</span></div>
          <p className="my-3 text-sm text-muted">Vị trí và độ chính xác được gửi cho điều phối viên của chuyến này. Bạn có thể dừng bất cứ lúc nào.</p>
          {!done && <Button variant={gps.sharing ? 'secondary' : 'primary'} className="w-full" onClick={() => { if (gps.sharing) void gps.stop(); else gps.start(); }}>{gps.sharing ? 'Dừng chia sẻ vị trí' : 'Bật chia sẻ vị trí'}</Button>}
          {gps.lastSent && <p className="mt-3 text-xs text-muted">Lần gửi thành công: {new Date(gps.lastSent).toLocaleTimeString('vi-VN')} · ±{Math.round(gps.position?.accuracy ?? 0)} m</p>}
          {gps.sharing && gps.lastSent && now - gps.lastSent > 30000 && <p className="mt-2 text-sm text-amber-ink">Chưa gửi được vị trí mới trong hơn 30 giây. Kiểm tra mạng và tín hiệu GPS.</p>}
          <p className="mt-3 text-xs text-muted">Giữ trang này mở. Khóa màn hình hoặc đưa trình duyệt xuống nền có thể làm gián đoạn GPS. Hệ thống chỉ giữ vị trí cuối.</p>
        </section>
        {plan && <section className="card p-3"><FleetMap plan={plan} positions={latest && !done ? { [data.route.vehicle.id]: { ...latest, tracking: gps.sharing } } : {}} /></section>}
        <section className="card p-5"><div className="mb-4 flex justify-between gap-3"><h2 className="font-semibold">Các điểm cần ghé</h2><span className="text-xs text-muted">{data.route.stops.filter(s => s.status === 'done').length}/{data.route.stops.length} hoàn thành</span></div>
          {data.route.status === 'assigned' && <Button className="mb-4 w-full" disabled={busy} onClick={() => void act('start')}>Bắt đầu chuyến</Button>}
          <ol className="space-y-4">{data.route.stops.map((s, i) => <li key={s.id} className="rounded-lg border border-line p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold">{i + 1}. {s.id}</h3><span className="text-sm tabular-nums">{clockTime(s.etaMin)}</span></div><p className="mt-1 text-sm text-muted">{s.name}</p><p className="mt-2 text-xs text-muted">{Math.round(s.fillPct)}% đầy · khoảng {s.massKg.toFixed(1)} kg</p>
            <div className="mt-3 flex flex-wrap gap-2"><a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=18/${s.lat}/${s.lng}`}>Mở điểm trên bản đồ</a>{s.status === 'done' ? <span className="self-center text-sm font-semibold text-forest-ink">Đã thu gom ✓</span> : !done && <Button size="sm" variant="primary" disabled={busy} onClick={() => setConfirm(s)}>Xác nhận đã thu gom</Button>}</div>
          </li>)}</ol>
          <div className="mt-5 border-t border-line pt-4"><p className="text-sm font-medium">Điểm cuối · {data.destination.name}</p><p className="mt-1 text-xs text-muted">Dự kiến {clockTime(data.route.endMin)} · tổng {data.route.distanceKm.toFixed(1)} km</p></div>
          {!done && <Button className="mt-4 w-full" variant="primary" disabled={busy || data.route.stops.some(s => s.status !== 'done')} onClick={() => void act('finish')}>Hoàn tất chuyến tại điểm tiếp nhận</Button>}
        </section>
      </>}
      {expired && <p className="card p-5 text-sm">Vị trí đã dừng gửi. Liên hệ điều phối viên để nhận liên kết mới.</p>}
      <p className="text-center text-xs text-muted">GPS lấy từ thiết bị của bạn · trạm và khối lượng sử dụng dữ liệu mẫu.</p>
    </div>
    <Dialog open={!!confirm} onClose={() => setConfirm(null)} title={`Đã thu gom tại ${confirm?.id ?? ''}?`} footer={<><Button onClick={() => setConfirm(null)}>Chưa thu gom</Button><Button variant="primary" disabled={busy} onClick={() => confirm && void act('collected', confirm.id)}>Xác nhận hoàn thành</Button></>}>
      <p>Xác nhận cập nhật tiến độ cho điều phối viên. Khối lượng thực tế và chứng từ EPR cần được ghi nhận riêng khi cân tại điểm tiếp nhận.</p>
    </Dialog>
  </main>;
}
