import { useState } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { activeRoute, stationOps } from '../../domain/ops';
import { activeBinTxs } from '../../domain/selectors';
import { defaultDispatchConfig, planFor, toAssignedRoute } from '../../domain/dispatch';
import { fmtMin } from '../../domain/routing';
import { newId } from '../../domain/ids';
import type { AssignedRoute, RouteStop, StopClassAssigned } from '../../domain/types';
import { Icon, Wordmark, type IconName } from '../../components/icons';
import { Alert, Badge, Button, DemoTag, Dialog, EmptyState, FillMeter, StaleTag, toast, type Tone } from '../../components/ui';
import { dateTime, kg, n0, n1 } from '../../lib/format';

export const STOP_CLASS: Record<StopClassAssigned, { label: string; why: string; tone: Tone; icon: IconName }> = {
  priority: { label: 'Ưu tiên', why: 'Trạm đã dừng nhận (≥ 95 %)', tone: 'fault', icon: 'stop' },
  required: { label: 'Bắt buộc', why: 'Đạt 80 % hoặc dự báo đạt trước chuyến sau', tone: 'amber', icon: 'alert' },
  optional: { label: 'Ghé thêm', why: 'Gần tuyến, xe còn tải và thời gian', tone: 'neutral', icon: 'plus' },
};

const SKIP_REASONS = ['Không vào được trạm', 'Trạm đang bảo trì', 'Xe hết chỗ', 'Lý do khác'];

function Shell({ children, route }: { children: React.ReactNode; route?: AssignedRoute }) {
  return (
    <main id="main" tabIndex={-1} className="min-h-[calc(100dvh-44px)] bg-sunk/60 outline-none md:py-6">
      <div className="mx-auto min-h-[calc(100dvh-44px)] max-w-[480px] bg-paper md:min-h-0 md:rounded-lg md:border md:border-line md:shadow-2">
        <header className="sticky top-11 z-10 flex min-h-[56px] items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 md:rounded-t-lg">
          <div className="flex items-center gap-2.5">
            <Wordmark size={22} />
            <span className="h-5 w-px bg-line" />
            <span className="text-sm font-semibold text-ink">Tài xế</span>
          </div>
          <div className="flex items-center gap-2">
            {route && <span className="id-tag text-xs text-muted">{route.id}</span>}
            <DemoTag>Tuyến minh họa</DemoTag>
          </div>
        </header>
        <div className="px-4 pb-10 pt-4">{children}</div>
      </div>
      <p className="mx-auto mt-3 hidden max-w-[480px] text-center text-xs text-muted md:block">Màn hình tài xế · thiết kế cho điện thoại, dùng một tay ngoài trời</p>
    </main>
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

  if (!route) {
    const lastDone = [...state.routes].reverse().find((r) => r.status === 'done');
    const createDemo = () => {
      const cfg = defaultDispatchConfig(state);
      const plan = planFor(state, cfg);
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
                  Nhận tuyến demo từ RE Hub
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
        <p className="mt-2 text-xs text-muted">Khoảng cách từ ma trận giả lập. Khối lượng ước tính từ bản ghi trạm.</p>
        <ol className="mt-4" aria-label="Các điểm dừng">
          {stops.map((s, i) => (
            <StopRow key={s.stationId} stop={s} index={i} current={i === 0} />
          ))}
        </ol>
        <div className="mt-2 flex items-center gap-2 rounded bg-sunk px-3 py-2 text-sm text-ink-2">
          <Icon name="flag" size={16} />
          Kết thúc: {route.endAt === 'PARTNER' ? 'Đối tác tiếp nhận (minh họa)' : 'Kho RE (minh họa)'}
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
        <Button variant="primary" size="lg" icon="check" className="mt-5 w-full" onClick={() => setFinishing(true)}>
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
  const binNow = activeBinTxs(state, st, 'station');
  const binEstKg = binNow.reduce((s, t) => s + t.acceptedMassG, 0) / 1000;

  const confirmSwap = () => {
    const ts = Date.now();
    const collectionId = newId('TG');
    const newBinId = `BIN-${st.id.slice(3)}-${String(ts).slice(-4)}`;
    store.dispatch({ type: 'CONFIRM_COLLECTION', stationId: st.id, driver: route.driver, ts, collectionId, newBinId, routeId: route.id });
    const rec = store.getState().collections.find((c) => c.id === collectionId);
    setConfirming(false);
    toast(rec ? `Đã thay thùng ${st.id} · ${n0(rec.bottleCount)} chai vào lô ${rec.batchId}` : `Đã thay thùng ${st.id}`);
    document.getElementById('main')?.scrollIntoView({ block: 'start' });
  };

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
        Kết thúc: {route.endAt === 'PARTNER' ? 'Đối tác tiếp nhận (minh họa)' : 'Kho RE (minh họa)'}
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Xác nhận đã thay thùng tại ${st.id}?`}
        footer={
          <>
            <Button onClick={() => setConfirming(false)}>Chưa, quay lại</Button>
            <Button variant="primary" icon="check" onClick={confirmSwap}>
              Đã thay thùng
            </Button>
          </>
        }
      >
        <p>Xác nhận tạo phiếu thu gom và đặt mức đầy của trạm về 0. Không hoàn tác được trong ứng dụng.</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 rounded bg-sunk p-3">
          <div>
            <dt className="text-xs text-muted">Chai trong thùng</dt>
            <dd className="tnum font-semibold text-ink">{n0(binNow.length)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Khối lượng ước tính</dt>
            <dd className="tnum font-semibold text-ink">{kg(binEstKg, 2)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted">Số liệu từ bản ghi trạm. Khối lượng thật được cân khi tiếp nhận.</p>
      </Dialog>

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
