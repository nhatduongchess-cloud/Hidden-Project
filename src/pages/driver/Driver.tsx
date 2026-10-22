import { useState } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { activeRoute, stationOps } from '../../domain/ops';
import { defaultDispatchConfig, planFor, toAssignedRoute } from '../../domain/dispatch';
import { fmtMin } from '../../domain/routing';
import { collectTargets, pointOf, truckPos } from '../../domain/places';
import { fmtDistanceVi, fmtDurationVi } from '../../domain/geo';
import type { AssignedRoute, RouteStop } from '../../domain/types';
import { useRoadMetric, useRoadRoute } from '../../lib/roadHooks';
import { Icon } from '../../components/icons';
import { Alert, Badge, Button, Dialog, EmptyState, FillMeter, StaleTag, toast } from '../../components/ui';
import { RoadMap } from '../../components/LazyRoadMap';
import { dateTime, kg, n0, n1 } from '../../lib/format';
import { DriverShell, ProviderNote, STOP_CLASS, SwapDialog, placeMarkers } from './shared';

export { STOP_CLASS } from './shared';

const SKIP_REASONS = ['Không vào được trạm', 'Trạm đang bảo trì', 'Xe hết chỗ', 'Lý do khác'];

const METRIC_NOTE: Record<NonNullable<AssignedRoute['metric']>, string> = {
  road: 'Quãng đường và thời gian theo đường thực tế lúc lập tuyến.',
  estimate: 'Quãng đường ước tính theo đường thẳng (chưa có dữ liệu đường lúc lập tuyến).',
  mock: 'Khoảng cách từ dữ liệu mẫu.',
};

function Shell({ children, route }: { children: React.ReactNode; route?: AssignedRoute }) {
  return (
    <DriverShell tab="route" routeId={route?.id}>
      {children}
    </DriverShell>
  );
}

function StopRow({ stop, index, current }: { stop: RouteStop; index: number; current: boolean }) {
  const state = useAppState();
  const st = state.stations.find((s) => s.id === stop.stationId)!;
  const c = STOP_CLASS[stop.cls];
  return (
    <li className={`flex items-center gap-3 border-b border-line py-3 last:border-0 ${stop.status !== 'pending' ? 'opacity-70' : ''}`}>
      <span
        className={`tnum grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
          stop.status === 'done' ? 'bg-forest text-white' : stop.status === 'skipped' ? 'bg-sunk text-muted' : current ? 'bg-ink text-paper' : 'border-2 border-line-strong text-ink-2'
        }`}
        aria-hidden
      >
        {stop.status === 'done' ? <Icon name="check" size={16} strokeWidth={2.4} /> : stop.status === 'skipped' ? <Icon name="minus" size={16} /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="id-tag text-sm font-semibold text-ink">{st.id}</span>
          <span className="truncate text-sm text-ink-2">{st.name}</span>
        </div>
        <div className="mt-0.5 text-xs text-muted">
          {stop.status === 'done' && stop.doneAt ? `Đã thay thùng lúc ${dateTime(stop.doneAt).slice(6)}` : stop.status === 'skipped' ? `Bỏ qua: ${stop.skipReason}` : `Dự kiến ${fmtMin(stop.etaMin)} · mở ${st.accessWindow.start}–${st.accessWindow.end}`}
        </div>
      </div>
      {stop.status === 'pending' && (
        <Badge tone={c.tone} icon={c.icon}>
          {c.label}
        </Badge>
      )}
      {stop.status === 'done' && <span className="sr-only">Hoàn tất</span>}
    </li>
  );
}

export function DriverExperience() {
  const state = useAppState();
  const store = useStore();
  const route = activeRoute(state);
  const [confirming, setConfirming] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0]);
  const [finishing, setFinishing] = useState(false);
  const road = useRoadMetric(state);
  // The whole planned route on the map before starting, and the road to the current stop after.
  const pendingStop = route?.stops.find((s) => s.status === 'pending');
  const pendingSt = pendingStop ? state.stations.find((s) => s.id === pendingStop.stationId) : undefined;
  const plannedPts =
    route?.status === 'assigned' ? ['DEPOT', ...route.stops.map((s) => s.stationId), route.endAt].map((id) => pointOf(state, id)!).map(({ lat, lng }) => ({ lat, lng })) : null;
  const planned = useRoadRoute(plannedPts);
  const leg = useRoadRoute(route?.status === 'in_progress' && pendingSt ? [truckPos(state), { lat: pendingSt.lat, lng: pendingSt.lng }] : null);

  if (!route) {
    const lastDone = [...state.routes].reverse().find((r) => r.status === 'done');
    const createDemo = () => {
      const cfg = defaultDispatchConfig(state);
      const plan = planFor(state, cfg, road.metric);
      const r = toAssignedRoute(state, plan, cfg, Date.now());
      if (!r) {
        toast('Không có trạm nào cần thu gom theo quy tắc hiện tại.', 'info');
        return;
      }
      store.dispatch({ type: 'ASSIGN_ROUTE', route: r, ts: Date.now() });
      toast(`Đã giao tuyến ${r.id} với ${r.stops.length} điểm dừng`);
    };
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-ink">Tuyến của tôi</h1>
        {lastDone && (
          <Alert tone="success" className="mt-4" title={`Đã hoàn tất ${lastDone.id}`}>
            {lastDone.stops.filter((s) => s.status === 'done').length} thùng đã thay, giao tới {lastDone.endAt === 'PARTNER' ? 'đối tác tiếp nhận' : 'kho RE'}.
          </Alert>
        )}
        <div className="mt-4">
          <EmptyState
            icon="route"
            title="Chưa có tuyến được giao"
            action={
              <div className="flex flex-col items-center gap-2">
                <Button variant="primary" icon="route" onClick={createDemo}>
                  Nhận tuyến gợi ý
                </Button>
                <a href="#hub-routes" className="link text-sm">
                  Mở Tuyến thu gom trong RE Hub
                </a>
              </div>
            }
          >
            Người điều phối lập và giao tuyến trong RE Hub. Tuyến mới sẽ hiện ở đây.
          </EmptyState>
        </div>
      </Shell>
    );
  }

  const stops = route.stops;
  const currentIdx = stops.findIndex((s) => s.status === 'pending');
  const current = currentIdx >= 0 ? stops[currentIdx] : null;
  const handled = stops.filter((s) => s.status !== 'pending').length;
  const totalEstKg = stops.reduce((s, x) => s + x.estKg, 0);

  // Not started yet: overview first, then one deliberate start.
  if (route.status === 'assigned') {
    return (
      <Shell route={route}>
        <div className="eyebrow">Tuyến được giao</div>
        <h1 className="mt-1 text-xl font-semibold text-ink">
          {stops.length} điểm dừng · xuất phát {route.departure}
        </h1>
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded border border-line bg-panel p-3 text-center">
          <div>
            <dt className="text-xs text-muted">Quãng đường</dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">{n1(route.distanceKm)} km</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Thời gian</dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">{n0(route.durationMin)} phút</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Khối lượng</dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">≈ {kg(totalEstKg, 1)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">{METRIC_NOTE[route.metric ?? 'mock']} Khối lượng ước tính từ bản ghi trạm.</p>
        <div className="-mx-4 mt-4 sm:mx-0">
          <RoadMap
            className="h-[260px] sm:rounded sm:border sm:border-line"
            label={`Bản đồ tuyến ${route.id}: bãi xe, ${stops.length} điểm dừng và điểm kết thúc`}
            markers={placeMarkers(state, collectTargets(state), { order: Object.fromEntries(stops.map((s, i) => [s.stationId, i + 1])) })}
            lines={planned.value ? [{ id: 'planned', kind: planned.value.provider === 'estimate' ? 'estimate' : 'route', points: planned.value.geometry }] : []}
            zone={state.settings.zone}
            fitKey={`${state.settings.areaId}|${planned.value ? `r${planned.value.distanceM}` : 'pts'}`}
            fitPoints={planned.value?.geometry ?? plannedPts ?? undefined}
          />
        </div>
        <div className="mt-1.5">
          <ProviderNote provider={planned.value?.provider ?? null} loading={planned.loading} />
        </div>
        <ol className="mt-4" aria-label="Các điểm dừng">
          {stops.map((s, i) => (
            <StopRow key={s.stationId} stop={s} index={i} current={i === 0} />
          ))}
        </ol>
        <div className="mt-2 flex items-center gap-2 rounded bg-sunk px-3 py-2 text-sm text-ink-2">
          <Icon name="flag" size={16} />
          Kết thúc: {route.endAt === 'PARTNER' ? 'Đối tác tiếp nhận' : 'Kho RE'}
        </div>
        <Button variant="primary" size="lg" icon="play" className="mt-5 w-full" onClick={() => store.dispatch({ type: 'START_ROUTE', routeId: route.id })}>
          Bắt đầu tuyến
        </Button>
      </Shell>
    );
  }

  if (!current) {
    const done = stops.filter((s) => s.status === 'done');
    const cols = state.collections.filter((c) => done.some((d) => d.collectionId === c.id));
    const bottles = cols.reduce((s, c) => s + c.bottleCount, 0);
    const estKg = cols.reduce((s, c) => s + c.estimatedKg, 0);
    return (
      <Shell route={route}>
        <div className="flex flex-col items-center pt-4 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-forest text-white">
            <Icon name="flag" size={26} />
          </span>
          <h1 className="mt-3 text-xl font-semibold text-ink">Đã xử lý hết điểm dừng</h1>
          <p className="mt-1 text-sm text-ink-2">Giao thùng tới {route.endAt === 'PARTNER' ? 'đối tác tiếp nhận' : 'kho RE'} rồi kết thúc tuyến.</p>
        </div>
        <dl className="mt-5 grid grid-cols-3 gap-3 rounded border border-line bg-panel p-3 text-center">
          <div>
            <dt className="text-xs text-muted">Thùng đã thay</dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">{done.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Chai</dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">{n0(bottles)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Ước tính</dt>
            <dd className="tnum mt-0.5 font-semibold text-ink">{kg(estKg, 1)}</dd>
          </div>
        </dl>
        {stops.some((s) => s.status === 'skipped') && (
          <Alert tone="warn" className="mt-4" title="Có điểm dừng bị bỏ qua">
            Các trạm này sẽ quay lại danh sách cần xử lý của người điều phối khi kết thúc tuyến.
          </Alert>
        )}
        <ol className="mt-4">
          {stops.map((s, i) => (
            <StopRow key={s.stationId} stop={s} index={i} current={false} />
          ))}
        </ol>
        <a href={`#driver-nav-${route.endAt}`} className="btn btn-secondary btn-lg mt-5 w-full">
          <Icon name="arrowRight" size={20} /> Dẫn đường tới {route.endAt === 'PARTNER' ? 'điểm tiếp nhận' : 'bãi xe'}
        </a>
        <Button variant="primary" size="lg" icon="check" className="mt-2 w-full" onClick={() => setFinishing(true)}>
          Kết thúc tuyến
        </Button>
        <Dialog
          open={finishing}
          onClose={() => setFinishing(false)}
          title="Kết thúc tuyến?"
          footer={
            <>
              <Button onClick={() => setFinishing(false)}>Quay lại</Button>
              <Button
                variant="primary"
                onClick={() => {
                  store.dispatch({ type: 'FINISH_ROUTE', routeId: route.id, ts: Date.now() });
                  setFinishing(false);
                  toast(`Đã kết thúc ${route.id}`);
                }}
              >
                Kết thúc tuyến
              </Button>
            </>
          }
        >
          Xác nhận đã giao {done.length} thùng tới {route.endAt === 'PARTNER' ? 'đối tác tiếp nhận' : 'kho RE'}. Cân tiếp nhận được ghi riêng trong RE Hub.
        </Dialog>
      </Shell>
    );
  }

  const st = state.stations.find((s) => s.id === current.stationId)!;
  const ops = stationOps(state, st);
  const cls = STOP_CLASS[current.cls];

  return (
    <Shell route={route}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-ink-2">
          Điểm {currentIdx + 1}/{stops.length}
        </span>
        <span className="tnum text-muted">
          {handled} đã xử lý · {n1(route.distanceKm)} km
        </span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {stops.map((s, i) => (
          <span key={s.stationId} className={`h-1.5 flex-1 rounded-full ${s.status === 'done' ? 'bg-forest' : s.status === 'skipped' ? 'bg-line-strong' : i === currentIdx ? 'bg-ink' : 'bg-line'}`} />
        ))}
      </div>

      <section className="mt-4 rounded-lg border border-ink/80 bg-white p-4 shadow-1" aria-labelledby="stop-title">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={cls.tone} icon={cls.icon}>
            {cls.label}
          </Badge>
          <span className="tnum text-sm text-muted">Dự kiến {fmtMin(current.etaMin)}</span>
        </div>
        <h1 id="stop-title" className="mt-3">
          <span className="id-tag block text-3xl font-bold tracking-tight text-ink">{st.id}</span>
          <span className="mt-0.5 block text-base font-medium text-ink-2">
            {st.name} · {st.site}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted">{cls.why}</p>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>Mức đầy RE Hub nhận được</span>
            {ops.stale && <StaleTag>lần cuối {dateTime(ops.lastReadingTs).slice(6)}</StaleTag>}
          </div>
          <FillMeter pct={ops.hubFillPct} stale={ops.stale} warn={state.settings.warnPct} stop={state.settings.stopPct} />
        </div>
        {st.connection === 'offline' && (
          <Alert tone="stale" className="mt-3" title="Trạm đang mất kết nối">
            Mức đầy thực tế có thể cao hơn. Vẫn thay thùng bình thường; trạm tự đồng bộ khi có mạng.
          </Alert>
        )}
        {st.fault && (
          <Alert tone="stop" className="mt-3" title={st.fault === 'jam' ? 'Trạm báo kẹt rulo' : 'Trạm đang dừng khẩn cấp'}>
            Không gỡ kẹt. Thay thùng nếu cửa thùng mở được; kỹ thuật viên xử lý lỗi theo yêu cầu riêng.
          </Alert>
        )}

        <div className="mt-4 flex items-center gap-3 rounded border border-route/30 bg-[rgb(234_241_252)] p-3">
          <div className="min-w-0 flex-1">
            <div className="tnum text-base font-bold text-route-ink">
              {leg.value ? `${fmtDurationVi(leg.value.durationS)} · ${fmtDistanceVi(leg.value.distanceM)}` : 'Đang tìm đường…'}
            </div>
            <ProviderNote provider={leg.value?.provider ?? null} loading={!leg.value} compact className="mt-0.5" />
          </div>
          <a href={`#driver-nav-${st.id}`} className="btn btn-primary shrink-0">
            <Icon name="arrowRight" size={17} /> Dẫn đường
          </a>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Khung giờ vào trạm</dt>
            <dd className="tnum font-medium text-ink">
              {st.accessWindow.start}–{st.accessWindow.end}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Thùng hiện tại</dt>
            <dd className="font-medium text-ink">
              <span className="id-tag">{st.activeBinId}</span>
            </dd>
          </div>
        </dl>

        <ol className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm text-ink-2" aria-label="Các bước thay thùng">
          {['Mở cửa thùng bằng chìa. Trạm tự dừng nhận khi cửa mở.', 'Kéo thùng đầy ra, đẩy thùng rỗng vào đến khi khớp.', 'Đóng cửa và chờ màn hình trạm báo sẵn sàng.'].map((s, i) => (
            <li key={s} className="flex gap-2.5">
              <span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sunk text-[11px] font-bold text-ink">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>

        <Button variant="primary" size="lg" icon="bin" className="mt-5 w-full" onClick={() => setConfirming(true)}>
          Xác nhận thay thùng
        </Button>
        <Button variant="quiet" className="mt-2 w-full" onClick={() => setSkipping(true)}>
          Không thu gom được trạm này
        </Button>
      </section>

      <h2 className="mt-6 text-sm font-semibold text-ink">Các điểm dừng</h2>
      <ol className="mt-1">
        {stops.map((s, i) => (
          <StopRow key={s.stationId} stop={s} index={i} current={i === currentIdx} />
        ))}
      </ol>
      <div className="mt-1 flex items-center gap-2 rounded bg-sunk px-3 py-2 text-sm text-ink-2">
        <Icon name="flag" size={16} />
        Kết thúc: {route.endAt === 'PARTNER' ? 'Đối tác tiếp nhận' : 'Kho RE'}
      </div>

      <SwapDialog
        station={st}
        routeId={route.id}
        driver={route.driver}
        open={confirming}
        onClose={() => setConfirming(false)}
        onDone={() => document.getElementById('main')?.scrollIntoView({ block: 'start' })}
      />

      <Dialog
        open={skipping}
        onClose={() => setSkipping(false)}
        title={`Bỏ qua ${st.id}?`}
        footer={
          <>
            <Button onClick={() => setSkipping(false)}>Quay lại</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.dispatch({ type: 'SKIP_STOP', routeId: route.id, stationId: st.id, reason: skipReason });
                setSkipping(false);
                toast(`Đã bỏ qua ${st.id}. Người điều phối sẽ thấy lý do.`, 'warn');
              }}
            >
              Bỏ qua điểm này
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-2">Chọn lý do để người điều phối xử lý tiếp:</legend>
          <div className="flex flex-col gap-1.5">
            {SKIP_REASONS.map((r) => (
              <label key={r} className={`flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded border px-3 ${skipReason === r ? 'border-ink bg-white' : 'border-line'}`}>
                <input type="radio" name="skip-reason" value={r} checked={skipReason === r} onChange={() => setSkipReason(r)} className="accent-[rgb(var(--c-forest))]" />
                <span className="text-ink">{r}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </Dialog>
    </Shell>
  );
}
