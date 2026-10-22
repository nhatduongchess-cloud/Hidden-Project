import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { activeRoute, stationOps } from '../../domain/ops';
import { collectTargets, pointOf, truckPos } from '../../domain/places';
import { fmtDistanceVi, fmtDurationVi, pointAlong, type LatLng } from '../../domain/geo';
import { arrowFor, instructionVi, OFF_ROUTE_M, prepare, progress, shortInstructionVi, type NavProgress, type Prepared } from '../../domain/nav';
import { PROVIDER_LABEL } from '../../integrations/roadRouting';
import { useRoadRoute } from '../../lib/roadHooks';
import { Icon, type IconName } from '../../components/icons';
import { NavArrow } from '../../components/NavArrow';
import { Button, Drawer, toast } from '../../components/ui';
import { RoadMap, type MapLine, type MapMarker, type Padding } from '../../components/LazyRoadMap';
import { ClassBadge, ProviderNote, SwapDialog, placeMarkers, useMediaQuery } from './shared';
import { n0 } from '../../lib/format';

/**
 * Turn-by-turn navigation for the collection truck, laid out like phone navigation apps:
 * a maneuver banner on top, the road ahead on the map, time and distance left at the bottom.
 * The truck moves by simulation (for demos) or by the phone's GPS, with rerouting when it
 * leaves the line.
 */

type Mode = 'overview' | 'driving' | 'arrived';
const SPEEDS = [1, 5, 20] as const;
/** Fallback road speed when a step has no duration, m/s. */
const DEFAULT_MS = 6;

function speedAt(p: Prepared, along: number): number {
  const { steps } = p.route;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (p.stepAlong[i] <= along) {
      const s = steps[i];
      const v = s.durationS > 1 && s.distanceM > 0 ? s.distanceM / s.durationS : DEFAULT_MS;
      return Math.min(25, Math.max(2, v));
    }
  }
  return DEFAULT_MS;
}

const clock = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Live height of an overlay, so the map keeps the truck and route clear of it. */
function useHeight<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [h, setH] = useState(0);
  const ro = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect();
    ro.current = null;
    if (!el) return;
    const update = () => setH(Math.round(el.getBoundingClientRect().height));
    ro.current = new ResizeObserver(update);
    ro.current.observe(el);
    update();
  }, []);
  return [ref, h];
}

export function Navigation({ targetId }: { targetId: string }) {
  const state = useAppState();
  const store = useStore();
  const dest = pointOf(state, targetId);
  const station = state.stations.find((s) => s.id === targetId) ?? null;
  const route = activeRoute(state);
  const wide = useMediaQuery('(min-width: 768px)');

  // The trip starts where the truck is now; a reroute replaces the origin.
  const [origin, setOrigin] = useState<LatLng>(() => truckPos(store.getState()));
  const [nonce, setNonce] = useState(0);
  const destPt = dest ? { lat: dest.lat, lng: dest.lng } : null;
  const rr = useRoadRoute(destPt ? [origin, destPt] : null, nonce);
  const roadRoute = rr.value ?? rr.last;
  const prepared = useMemo(() => (roadRoute ? prepare(roadRoute) : null), [roadRoute]);

  const [mode, setMode] = useState<Mode>('overview');
  const [source, setSource] = useState<'sim' | 'gps'>('sim');
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(5);
  const [along, setAlong] = useState(0);
  const [gps, setGps] = useState<{ pos: LatLng; heading: number | null } | null>(null);
  const minAlong = useRef(0);
  const offCount = useRef(0);
  const [follow, setFollow] = useState(true);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [swapped, setSwapped] = useState(false);

  // A new route (first answer or a reroute) restarts progress along it.
  useEffect(() => {
    setAlong(0);
    minAlong.current = 0;
    offCount.current = 0;
  }, [prepared]);

  // Simulated driving at the road's own speed for each step, times the demo multiplier.
  useEffect(() => {
    if (!running || !prepared || source !== 'sim') return;
    const total = prepared.cum[prepared.cum.length - 1] ?? 0;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      setAlong((a) => Math.min(total, a + speedAt(prepared, a) * dt * speed));
    }, 200);
    return () => window.clearInterval(id);
  }, [running, prepared, source, speed]);

  // Real GPS from the phone.
  useEffect(() => {
    if (mode !== 'driving' || source !== 'gps') return;
    if (!navigator.geolocation) {
      toast('Trình duyệt này không hỗ trợ định vị. Chuyển sang mô phỏng.', 'warn');
      setSource('sim');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => setGps({ pos: { lat: p.coords.latitude, lng: p.coords.longitude }, heading: p.coords.heading ?? null }),
      (e) => {
        toast(e.code === e.PERMISSION_DENIED ? 'Chưa được cấp quyền vị trí. Chuyển sang mô phỏng.' : 'Mất tín hiệu GPS. Chuyển sang mô phỏng.', 'warn');
        setSource('sim');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [mode, source]);

  // Keep the screen on while driving, where the browser allows it.
  useEffect(() => {
    if (mode !== 'driving' || !('wakeLock' in navigator)) return;
    let lock: { release(): Promise<void> } | null = null;
    (navigator as Navigator & { wakeLock: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock
      .request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined);
    return () => void lock?.release().catch(() => undefined);
  }, [mode]);

  // Where the truck is on the line.
  const vehicle = useMemo(() => {
    if (!prepared) return null;
    if (source === 'gps' && gps && mode === 'driving') {
      const prog = progress(prepared, gps.pos, minAlong.current);
      const onLine = prog.offRouteM <= OFF_ROUTE_M;
      const at = pointAlong(prepared.route.geometry, prepared.cum, prog.along);
      return { prog, point: onLine ? prog.point : gps.pos, heading: gps.heading ?? at.heading };
    }
    const at = pointAlong(prepared.route.geometry, prepared.cum, along);
    return { prog: progress(prepared, at.point, Math.max(0, along - 5)), point: at.point, heading: at.heading };
  }, [prepared, along, gps, source, mode]);
  const prog: NavProgress | null = vehicle?.prog ?? null;

  // GPS: on each fix, keep progress monotonic and reroute after two fixes off the line.
  useEffect(() => {
    if (!prepared || source !== 'gps' || mode !== 'driving' || !gps) return;
    const p = progress(prepared, gps.pos, minAlong.current);
    minAlong.current = Math.max(minAlong.current, p.along);
    if (p.offRouteM > OFF_ROUTE_M) {
      offCount.current++;
      if (offCount.current >= 2 && !rr.loading) {
        offCount.current = 0;
        toast('Xe đã rời tuyến. Đang tìm đường mới…', 'info');
        setOrigin(gps.pos);
        setNonce((n) => n + 1);
      }
    } else offCount.current = 0;
    // Runs once per GPS fix.
  }, [gps]);

  // Arrival, handled once.
  const arrivedOnce = useRef(false);
  const arrived = mode === 'driving' && !!prog?.arrived;
  useEffect(() => {
    if (!arrived || !dest || arrivedOnce.current) return;
    arrivedOnce.current = true;
    setRunning(false);
    setMode('arrived');
    store.dispatch({ type: 'SET_DRIVER_POS', pos: { lat: dest.lat, lng: dest.lng } });
    // dest is looked up from the store on every render; its id is stable for this screen.
  }, [arrived]);

  // Share the truck's position with the rest of the app, a few times a minute.
  const lastShare = useRef(0);
  useEffect(() => {
    if (mode !== 'driving' || !vehicle) return;
    const now = Date.now();
    if (now - lastShare.current < 3000) return;
    lastShare.current = now;
    store.dispatch({ type: 'SET_DRIVER_POS', pos: { lat: +vehicle.point.lat.toFixed(6), lng: +vehicle.point.lng.toFixed(6) } });
  }, [vehicle, mode, store]);

  const [bannerRef, bannerH] = useHeight<HTMLDivElement>();
  const [sheetRef, sheetH] = useHeight<HTMLDivElement>();

  if (!dest) {
    return (
      <main id="main" tabIndex={-1} className="mx-auto max-w-[480px] px-4 py-10 outline-none">
        <h1 className="text-xl font-semibold text-ink">Không tìm thấy điểm đến</h1>
        <p className="mt-1 text-sm text-ink-2">Mã “{targetId}” không có trong danh sách điểm thu gom.</p>
        <a href="#driver-map" className="btn btn-secondary mt-4">
          <Icon name="arrowLeft" size={16} /> Danh sách trạm
        </a>
      </main>
    );
  }

  const steps = prepared?.route.steps ?? [];
  const next = prog ? steps[prog.next] : undefined;
  const after = prog && next && next.kind !== 'arrive' ? steps[prog.next + 1] : undefined;
  const showThen = !!(after && prepared && prog && prepared.stepAlong[prog.next + 1] - prepared.stepAlong[prog.next] < 400);
  const remainingS = prog?.remainingS ?? roadRoute?.durationS ?? 0;
  const remainingM = prog?.remainingM ?? roadRoute?.distanceM ?? 0;
  const provider = roadRoute?.provider ?? null;
  const destName = station ? `${station.id} · ${station.name}` : dest.name;
  const onRoute = !!(station && route?.stops.some((s) => s.stationId === station.id && s.status === 'pending'));
  const targetInfo = station ? collectTargets(state).find((t) => t.id === station.id) : undefined;
  const ops = station ? stationOps(state, station) : null;

  const start = (src: 'sim' | 'gps') => {
    setSource(src);
    setMode('driving');
    setFollow(true);
    if (src === 'sim') setRunning(true);
  };
  const skipToTurn = () => {
    if (!prepared || !prog) return;
    const target = prepared.stepAlong[prog.next] - 35;
    if (target > along) setAlong(target);
  };

  /* ---------- Map content ---------- */
  const markers: MapMarker[] = [
    ...placeMarkers(state, targetInfo ? [targetInfo] : [], { selected: targetId }).filter((m) => m.kind === 'station' || m.id === targetId),
  ];
  const truck = mode === 'overview' || !vehicle ? { point: origin, heading: vehicle?.heading ?? 0 } : vehicle;
  markers.push({ id: 'TRUCK', kind: 'truck', ...truck.point, heading: truck.heading, title: 'Xe thu gom' });
  const lines: MapLine[] = [];
  if (prepared) {
    const g = prepared.route.geometry;
    const kind = prepared.route.provider === 'estimate' ? 'estimate' : 'route';
    if (mode === 'overview' || !prog) lines.push({ id: 'ahead', kind, points: g });
    else {
      const cut = prog.segIndex + 1;
      lines.push({ id: 'done', kind: 'travelled', points: [...g.slice(0, cut), truck.point] });
      lines.push({ id: 'ahead', kind, points: [truck.point, ...g.slice(cut)] });
    }
  }
  const pad: Padding = wide ? { top: 16, right: 16, bottom: 16, left: 412 } : { top: mode === 'driving' ? bannerH + 16 : 16, right: 0, bottom: sheetH, left: 0 };
  const following = mode === 'driving' && follow;

  /* ---------- Overlays ---------- */
  const banner =
    mode === 'driving' && next && prog ? (
      <div ref={bannerRef} className="overflow-hidden rounded-lg bg-forest-ink text-white shadow-3">
        <div className="flex items-center gap-3 px-4 py-3">
          <NavArrow icon={arrowFor(next)} size={46} />
          <div className="min-w-0">
            <div className="tnum text-[30px] font-bold leading-none">{fmtDistanceVi(prog.distToNextM)}</div>
            <div className="mt-1 text-[17px] font-semibold leading-snug">{instructionVi(next, destName)}</div>
          </div>
        </div>
        {showThen && after && (
          <div className="flex items-center gap-2 bg-black/20 px-4 py-1.5 text-sm font-medium">
            <span className="text-white/75">Sau đó</span>
            <NavArrow icon={arrowFor(after)} size={18} />
            {shortInstructionVi(after)}
          </div>
        )}
        {provider === 'estimate' && <div className="bg-amber-ink px-4 py-1 text-xs font-semibold text-white">Không có dữ liệu đường · chỉ hướng theo đường thẳng</div>}
        {/* Announced once per maneuver, not on every distance update. */}
        <span className="sr-only" aria-live="polite">
          Tiếp theo: {instructionVi(next, destName)}
        </span>
      </div>
    ) : null;

  const controlBtn = (label: string, icon: IconName, onClick: () => void, pressed?: boolean) => (
    <button type="button" onClick={onClick} aria-pressed={pressed} className="inline-flex min-h-[40px] items-center gap-1.5 rounded border border-line-strong bg-white px-3 text-sm font-semibold text-ink hover:bg-sunk">
      <Icon name={icon} size={16} />
      {label}
    </button>
  );

  let sheet: ReactNode;
  if (mode === 'arrived') {
    const nextStop = route?.stops.find((s) => s.status === 'pending' && s.stationId !== targetId);
    const allHandled = route && !route.stops.some((s) => s.status === 'pending');
    sheet = (
      <div className="p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest text-white">
            <Icon name="flag" size={22} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wider text-forest">Đã đến nơi</div>
            <h1 className="truncate text-lg font-semibold text-ink">{destName}</h1>
          </div>
        </div>
        {station && !swapped && (
          <>
            {ops && <p className="tnum mt-2 text-sm text-ink-2">Mức đầy RE Hub nhận được: {n0(ops.hubFillPct)} %{ops.stale ? ' (số đo cũ)' : ''} · thùng {station.activeBinId}</p>}
            <Button variant="primary" size="lg" icon="bin" className="mt-3 w-full" onClick={() => setSwapOpen(true)}>
              Xác nhận thay thùng
            </Button>
            <a href="#driver" className="btn btn-quiet mt-1 w-full">
              Về danh sách điểm dừng
            </a>
          </>
        )}
        {station && swapped && (
          <div className="mt-3 flex flex-col gap-2">
            {nextStop ? (
              <a href={`#driver-nav-${nextStop.stationId}`} className="btn btn-primary btn-lg w-full">
                <Icon name="arrowRight" size={20} /> Dẫn đường tới {nextStop.stationId}
              </a>
            ) : allHandled && route ? (
              <a href={`#driver-nav-${route.endAt}`} className="btn btn-primary btn-lg w-full">
                <Icon name="arrowRight" size={20} /> Dẫn đường tới {route.endAt === 'PARTNER' ? 'điểm tiếp nhận' : 'bãi xe'}
              </a>
            ) : null}
            <a href="#driver-map" className={`btn w-full ${nextStop || allHandled ? 'btn-secondary' : 'btn-primary btn-lg'}`}>
              <Icon name="mapPin" size={18} /> Tìm trạm gần nhất tiếp theo
            </a>
          </div>
        )}
        {!station && (
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-sm text-ink-2">{route && route.status === 'in_progress' && allHandled ? 'Giao thùng rồi kết thúc tuyến trong màn hình Tuyến.' : 'Xe đã về điểm này.'}</p>
            <a href="#driver" className="btn btn-primary btn-lg w-full">
              <Icon name="list" size={20} /> Về màn hình tuyến
            </a>
          </div>
        )}
      </div>
    );
  } else if (mode === 'driving') {
    sheet = (
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="tnum text-2xl font-bold text-forest">{fmtDurationVi(remainingS)}</div>
            <div className="tnum text-sm text-ink-2">
              {fmtDistanceVi(remainingM)} · đến lúc {clock(Date.now() + remainingS * 1000)}
            </div>
          </div>
          <a href={station ? '#driver-map' : '#driver'} className="btn btn-secondary btn-sm" aria-label="Thoát dẫn đường">
            <Icon name="x" size={16} /> Thoát
          </a>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {source === 'sim' ? (
            <>
              {controlBtn(running ? 'Tạm dừng' : 'Chạy tiếp', running ? 'pause' : 'play', () => setRunning((r) => !r))}
              <div className="inline-flex rounded border border-line-strong bg-white p-0.5" role="group" aria-label="Tốc độ mô phỏng">
                {SPEEDS.map((s) => (
                  <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={`tnum min-h-[36px] rounded-sm px-2.5 text-sm font-semibold ${speed === s ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-sunk'}`}>
                    ×{s}
                  </button>
                ))}
              </div>
              {controlBtn('Tới chỗ rẽ', 'chevronRight', skipToTurn)}
            </>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-2">
              <span className="h-2 w-2 rounded-full bg-forest" aria-hidden /> {gps ? 'Đang theo GPS điện thoại' : 'Đang chờ tín hiệu GPS…'}
            </span>
          )}
          {controlBtn('Các bước', 'list', () => setStepsOpen(true))}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <ProviderNote provider={provider} loading={!roadRoute} />
          <span className="text-xs text-muted">{source === 'sim' ? 'Xe chạy mô phỏng' : 'Vị trí thật'}</span>
        </div>
      </div>
    );
  } else {
    sheet = (
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted">Dẫn đường tới</div>
            <h1 className="text-lg font-semibold leading-snug text-ink">{destName}</h1>
            {targetInfo && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <ClassBadge cls={targetInfo.cls} />
                <span className="tnum text-xs text-muted">{n0(targetInfo.fillPct)} %</span>
                {!targetInfo.inZone && <span className="text-xs font-medium text-amber-ink">Ngoài phạm vi thu gom</span>}
              </div>
            )}
          </div>
          <a href={station ? '#driver-map' : '#driver'} className="btn btn-quiet btn-sm -mr-2" aria-label="Quay lại">
            <Icon name="x" size={18} />
          </a>
        </div>
        <div className="mt-3 flex items-end gap-3">
          {roadRoute ? (
            <>
              <span className="tnum text-2xl font-bold text-forest">{fmtDurationVi(roadRoute.durationS)}</span>
              <span className="tnum pb-0.5 text-sm text-ink-2">
                {fmtDistanceVi(roadRoute.distanceM)} · đến lúc {clock(Date.now() + roadRoute.durationS * 1000)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">Đang tìm đường…</span>
          )}
        </div>
        <div className="mt-1">
          <ProviderNote provider={provider} loading={!roadRoute} />
          {rr.failed.length > 0 && provider !== 'estimate' && (
            <p className="mt-0.5 text-xs text-muted">{rr.failed.map((f) => PROVIDER_LABEL[f.provider].name).join(', ')} không phản hồi, đã dùng dịch vụ dự phòng.</p>
          )}
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <Button variant="primary" size="lg" icon="arrowRight" disabled={!prepared} onClick={() => start('sim')}>
            Bắt đầu
          </Button>
          <Button size="lg" icon="list" disabled={!prepared} onClick={() => setStepsOpen(true)}>
            Các bước
          </Button>
        </div>
        <button type="button" disabled={!prepared} onClick={() => start('gps')} className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-forest disabled:text-muted">
          <Icon name="mapPin" size={16} /> Dùng GPS điện thoại thay cho mô phỏng
        </button>
        {onRoute && route && <p className="mt-1 text-xs text-muted">Điểm dừng trên tuyến {route.id}.</p>}
      </div>
    );
  }

  return (
    <main id="main" tabIndex={-1} className="fixed inset-x-0 bottom-0 top-[env(safe-area-inset-top,0px)] overflow-hidden bg-paper outline-none">
      <RoadMap
        className="absolute inset-0"
        label={`Bản đồ dẫn đường tới ${destName}`}
        markers={markers}
        lines={lines}
        zone={mode === 'overview' ? state.settings.zone : null}
        padding={pad}
        fitKey={mode === 'overview' ? `${state.settings.areaId}|${roadRoute ? roadRoute.distanceM : '-'}|${wide}|${Math.round(sheetH / 40)}` : undefined}
        fitPoints={roadRoute ? roadRoute.geometry : [origin, dest]}
        follow={following ? truck.point : null}
        followZoom={17}
        zoomControl={wide}
        onUserMove={() => mode === 'driving' && setFollow(false)}
      />

      {wide ? (
        <aside className="pointer-events-none absolute bottom-4 left-4 top-4 z-[700] flex w-[380px] flex-col gap-3 overflow-y-auto *:pointer-events-auto" aria-label="Dẫn đường">
          {banner}
          <div ref={sheetRef} className="rounded-lg border border-line bg-paper shadow-2">
            {sheet}
          </div>
        </aside>
      ) : (
        <>
          {banner && <div className="absolute inset-x-2 top-2 z-[700]">{banner}</div>}
          <div ref={sheetRef} className="absolute inset-x-0 bottom-0 z-[700] rounded-t-xl border-t border-line bg-paper shadow-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" aria-hidden />
            {sheet}
          </div>
        </>
      )}

      {mode === 'driving' && !follow && (
        <button
          type="button"
          onClick={() => setFollow(true)}
          className="absolute right-3 z-[700] inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-route-ink shadow-2"
          style={{ bottom: wide ? 24 : sheetH + 12 }}
        >
          <Icon name="truck" size={17} /> Căn giữa
        </button>
      )}

      <Drawer open={stepsOpen} onClose={() => setStepsOpen(false)} title={`Các bước tới ${station?.id ?? dest.name}`} width={420}>
        {prepared ? (
          <ol className="flex flex-col">
            {steps.map((s, i) => {
              const current = mode === 'driving' && prog?.next === i;
              const passed = mode === 'driving' && prog ? prepared.stepAlong[i] < prog.along - 3 && i < prog.next : false;
              return (
                <li key={i} className={`flex items-start gap-3 border-b border-line py-3 last:border-0 ${passed ? 'opacity-50' : ''}`} aria-current={current ? 'step' : undefined}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded ${current ? 'bg-forest-ink text-white' : 'bg-sunk text-ink'}`}>
                    <NavArrow icon={arrowFor(s)} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{instructionVi(s, destName)}</span>
                    {s.kind !== 'arrive' && s.distanceM > 0 && <span className="tnum block text-xs text-muted">Đi tiếp {fmtDistanceVi(s.distanceM)}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-muted">Đang tìm đường…</p>
        )}
        {provider && <p className="mt-3 text-xs text-muted">{PROVIDER_LABEL[provider].note}</p>}
      </Drawer>

      {station && (
        <SwapDialog
          station={station}
          routeId={onRoute ? route!.id : undefined}
          driver={route?.driver ?? 'Tài xế demo 01'}
          open={swapOpen}
          onClose={() => setSwapOpen(false)}
          onDone={() => setSwapped(true)}
        />
      )}
    </main>
  );
}
