import { useEffect, useState, type ReactNode } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { activeBinTxs } from '../../domain/selectors';
import { newId } from '../../domain/ids';
import type { AppState, Station, StopClassAssigned } from '../../domain/types';
import type { ProviderId } from '../../domain/nav';
import type { CollectTarget } from '../../domain/places';
import { PROVIDER_LABEL } from '../../integrations/roadRouting';
import { Icon, Wordmark, type IconName } from '../../components/icons';
import { Badge, Button, DemoTag, Dialog, Spinner, toast, type Tone } from '../../components/ui';
import type { MapMarker, MarkerTone } from '../../components/LazyRoadMap';
import { kg, n0 } from '../../lib/format';

export const STOP_CLASS: Record<StopClassAssigned, { label: string; why: string; tone: Tone; icon: IconName }> = {
  priority: { label: 'Ưu tiên', why: 'Trạm đã dừng nhận (≥ 95 %)', tone: 'fault', icon: 'stop' },
  required: { label: 'Bắt buộc', why: 'Đạt 80 % hoặc dự báo đạt trước chuyến sau', tone: 'amber', icon: 'alert' },
  optional: { label: 'Ghé thêm', why: 'Gần tuyến, xe còn tải và thời gian', tone: 'neutral', icon: 'plus' },
};

export const PIN_TONE: Record<StopClassAssigned | 'none', MarkerTone> = { priority: 'fault', required: 'amber', optional: 'forest', none: 'neutral' };

/** Station, depot and partner pins. `targets` decides each station's colour (stations not listed are grey). */
export function placeMarkers(state: AppState, targets: CollectTarget[], opts: { selected?: string; order?: Record<string, number>; draggable?: boolean } = {}): MapMarker[] {
  const cls = new Map(targets.map((t) => [t.id, t.cls]));
  const out: MapMarker[] = state.stations.map((st) => ({
    id: st.id,
    kind: 'station',
    lat: st.lat,
    lng: st.lng,
    label: st.id,
    tone: PIN_TONE[cls.get(st.id) ?? 'none'],
    order: opts.order?.[st.id],
    selected: opts.selected === st.id,
    title: `${st.id} · ${st.name}${cls.has(st.id) ? ` · ${STOP_CLASS[cls.get(st.id)!].label}` : ''}`,
    draggable: opts.draggable,
  }));
  const { depot, partner } = state.settings;
  out.push({ id: 'DEPOT', kind: 'depot', lat: depot.lat, lng: depot.lng, label: 'Bãi xe', title: depot.name, draggable: opts.draggable, selected: opts.selected === 'DEPOT' });
  out.push({ id: 'PARTNER', kind: 'partner', lat: partner.lat, lng: partner.lng, label: 'Tiếp nhận', title: partner.name, draggable: opts.draggable, selected: opts.selected === 'PARTNER' });
  return out;
}

export function useMediaQuery(q: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

/** Which routing source produced a time or a line, always shown next to it. */
export function ProviderNote({ provider, loading, compact, className = '' }: { provider: ProviderId | null; loading?: boolean; compact?: boolean; className?: string }) {
  if (loading || !provider)
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`} role="status">
        <Spinner size={12} /> Đang tìm đường trên bản đồ…
      </span>
    );
  const p = PROVIDER_LABEL[provider];
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${provider === 'estimate' ? 'text-amber-ink' : 'text-muted'} ${className}`} title={p.note}>
      <Icon name={provider === 'estimate' ? 'alert' : 'route'} size={13} />
      <span>
        {provider === 'estimate'
          ? 'Ước tính đường thẳng, chưa có dữ liệu đường'
          : compact
            ? `Đường thực tế · ${p.name.split(' ·')[0]}`
            : `Đường thực tế · ${p.name} · ${p.profile.toLowerCase()}`}
      </span>
    </span>
  );
}

export function DriverShell({ children, tab, routeId }: { children: ReactNode; tab: 'route' | 'map'; routeId?: string }) {
  return (
    <main id="main" tabIndex={-1} className="min-h-[calc(100dvh-44px)] bg-sunk/60 outline-none md:py-6">
      <div className="mx-auto min-h-[calc(100dvh-44px)] max-w-[480px] bg-paper md:min-h-0 md:rounded-lg md:border md:border-line md:shadow-2">
        <header className="sticky top-11 z-10 border-b border-line bg-paper/95 md:rounded-t-lg">
          <div className="flex min-h-[52px] items-center justify-between gap-3 px-4">
            <div className="flex items-center gap-2.5">
              <Wordmark size={22} />
              <span className="h-5 w-px bg-line" />
              <span className="text-sm font-semibold text-ink">Tài xế</span>
            </div>
            <div className="flex items-center gap-2">
              {routeId && <span className="id-tag text-xs text-muted">{routeId}</span>}
              <DemoTag>Dữ liệu demo</DemoTag>
            </div>
          </div>
          <nav aria-label="Màn hình tài xế" className="flex gap-1 px-3 pb-2">
            {(
              [
                ['route', '#driver', 'Tuyến', 'list'],
                ['map', '#driver-map', 'Bản đồ', 'map'],
              ] as const
            ).map(([id, href, label, icon]) => (
              <a
                key={id}
                href={href}
                aria-current={tab === id ? 'page' : undefined}
                className={`inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded text-sm font-semibold ${tab === id ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-sunk'}`}
              >
                <Icon name={icon} size={16} />
                {label}
              </a>
            ))}
          </nav>
        </header>
        <div className="px-4 pb-10 pt-4">{children}</div>
      </div>
      <p className="mx-auto mt-3 hidden max-w-[480px] text-center text-xs text-muted md:block">Màn hình tài xế · thiết kế cho điện thoại, dùng một tay ngoài trời</p>
    </main>
  );
}

/** Confirm a bin swap: creates the collection record and resets the station's fill. Shared by the stop card and navigation. */
export function SwapDialog({ station, routeId, driver, open, onClose, onDone }: { station: Station; routeId?: string; driver: string; open: boolean; onClose: () => void; onDone?: () => void }) {
  const state = useAppState();
  const store = useStore();
  const binNow = activeBinTxs(state, station, 'station');
  const binEstKg = binNow.reduce((s, t) => s + t.acceptedMassG, 0) / 1000;
  const confirm = () => {
    const ts = Date.now();
    const collectionId = newId('TG');
    const newBinId = `BIN-${station.id.slice(3)}-${String(ts).slice(-4)}`;
    store.dispatch({ type: 'CONFIRM_COLLECTION', stationId: station.id, driver, ts, collectionId, newBinId, routeId });
    const rec = store.getState().collections.find((c) => c.id === collectionId);
    onClose();
    toast(rec ? `Đã thay thùng ${station.id} · ${n0(rec.bottleCount)} chai vào lô ${rec.batchId}` : `Đã thay thùng ${station.id}`);
    onDone?.();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Xác nhận đã thay thùng tại ${station.id}?`}
      footer={
        <>
          <Button onClick={onClose}>Chưa, quay lại</Button>
          <Button variant="primary" icon="check" onClick={confirm}>
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
  );
}

export function ClassBadge({ cls }: { cls: StopClassAssigned }) {
  const c = STOP_CLASS[cls];
  return (
    <Badge tone={c.tone} icon={c.icon}>
      {c.label}
    </Badge>
  );
}
