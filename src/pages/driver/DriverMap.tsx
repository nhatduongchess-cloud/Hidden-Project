import { useMemo, useState } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { useT } from '../../i18n';
import { activeRoute } from '../../domain/ops';
import { collectTargets, rankNearest, truckLabel, truckPos, type Ranked } from '../../domain/places';
import { bearingDeg, fmtDistanceVi, fmtDurationVi, haversineM } from '../../domain/geo';
import { areaById, nearestArea } from '../../domain/areas';
import { AreaSelect } from '../../components/AreaSelect';
import { useMatrix, useRoadRoute } from '../../lib/roadHooks';
import { Icon } from '../../components/icons';
import { Alert, Button, EmptyState, Skeleton, StaleTag, toast } from '../../components/ui';
import { RoadMap, type MapLine, type MapMarker } from '../../components/LazyRoadMap';
import { ClassBadge, DriverShell, ProviderNote, placeMarkers } from './shared';
import { n0 } from '../../lib/format';

/** Beyond this the truck is clearly not working the demo area. */
const FAR_FROM_ZONE_M = 30_000;
/** A GPS position this close to another area's centre offers to switch to it. */
const NEAR_AREA_KM = 40;

/**
 * "Trạm cần thu gom gần nhất": every station that needs a pickup inside the collection zone,
 * ranked by driving time from where the truck is, with the road to the chosen one on the map.
 */
export function DriverMap() {
  const state = useAppState();
  const store = useStore();
  const reasons = useT().hub.routes.reasons as Record<string, string>;
  const route = activeRoute(state);
  const origin = truckPos(state);
  const targets = useMemo(() => collectTargets(state), [state]);
  const matrix = useMatrix([origin], targets);
  const ranking = useMemo(
    () => (matrix.value ? rankNearest(origin, targets, matrix.value.durationsS[0] ?? [], matrix.value.distancesM[0] ?? []) : null),
    // Targets change with every reading; the ranking only needs to follow the matrix and the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matrix.value, targets.map((t) => `${t.id}:${t.cls}:${t.inZone}`).join(',')],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const selectedId = picked && targets.some((t) => t.id === picked) ? picked : (ranking?.fastestId ?? null);
  const selected = targets.find((t) => t.id === selectedId) ?? null;
  const preview = useRoadRoute(selected ? [origin, { lat: selected.lat, lng: selected.lng }] : null);
  const nextPlanned = route?.stops.find((s) => s.status === 'pending');
  const [locating, setLocating] = useState(false);
  const area = areaById(state.settings.areaId);
  // A GPS position far from the collection zone, e.g. a phone in another city than the demo area.
  const awayM = state.driverPos ? haversineM(state.driverPos, state.settings.zone) : 0;
  const near = awayM > FAR_FROM_ZONE_M ? nearestArea(state.driverPos!) : null;
  const switchTo = near && near.km < NEAR_AREA_KM && near.area.id !== area.id ? near.area : null;

  const markers: MapMarker[] = [
    ...placeMarkers(state, targets, { selected: selectedId ?? undefined }),
    {
      id: 'TRUCK',
      kind: 'truck',
      ...origin,
      heading: selected ? bearingDeg(origin, selected) : 0,
      title: `Xe thu gom · ${truckLabel(state)}`,
    },
  ];
  const lines: MapLine[] = preview.value ? [{ id: 'preview', kind: preview.value.provider === 'estimate' ? 'estimate' : 'route', points: preview.value.geometry }] : [];

  const useGps = () => {
    if (!navigator.geolocation) {
      toast('Trình duyệt này không hỗ trợ định vị.', 'warn');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        store.dispatch({ type: 'SET_DRIVER_POS', pos: { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) } });
        toast('Đã cập nhật vị trí xe theo GPS.');
      },
      (e) => {
        setLocating(false);
        toast(e.code === e.PERMISSION_DENIED ? 'Chưa được cấp quyền vị trí. Vị trí xe giữ nguyên.' : 'Không lấy được vị trí GPS. Vị trí xe giữ nguyên.', 'warn');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const straightNote = (() => {
    if (!ranking || !ranking.fastestId || !ranking.straightNearestId || ranking.fastestId === ranking.straightNearestId) return null;
    const near = ranking.inZone.find((r) => r.id === ranking.straightNearestId)!;
    const fast = ranking.inZone.find((r) => r.id === ranking.fastestId)!;
    if (near.driveS == null || fast.driveS == null) return null;
    return `${near.id} gần hơn theo đường chim bay (${fmtDistanceVi(near.straightM)}) nhưng đường đi mất ${fmtDurationVi(near.driveS)}. ${fast.id} đến nhanh hơn: ${fmtDurationVi(fast.driveS)}.`;
  })();

  return (
    <DriverShell tab="map" routeId={route?.id}>
      <h1 className="text-xl font-semibold text-ink">Trạm cần thu gom gần nhất</h1>
      <p className="mt-0.5 text-sm text-ink-2">Xếp theo thời gian lái xe từ vị trí xe, trong phạm vi thu gom.</p>

      <AreaSelect id="driver-area" className="mt-3 max-w-[20rem]" />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-line bg-panel px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-route text-white" aria-hidden>
            <Icon name="truck" size={13} />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted">Vị trí xe</span>
            <span className="block truncate font-medium text-ink">{truckLabel(state)}</span>
          </span>
        </span>
        <span className="flex gap-1">
          <Button size="sm" variant="ghost" icon="mapPin" loading={locating} onClick={useGps}>
            Lấy GPS
          </Button>
          {state.driverPos && (
            <Button size="sm" variant="ghost" onClick={() => store.dispatch({ type: 'SET_DRIVER_POS', pos: null })}>
              Về bãi xe
            </Button>
          )}
        </span>
      </div>

      {near && (
        <Alert
          tone="warn"
          icon="mapPin"
          className="mt-3"
          title={`Xe đang cách phạm vi thu gom ${fmtDistanceVi(awayM)}`}
          actions={
            switchTo && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  store.dispatch({ type: 'APPLY_AREA', areaId: switchTo.id, keepDriverPos: true });
                  toast(`Đã chuyển trạm minh họa tới ${switchTo.city}.`);
                }}
              >
                Chuyển sang {switchTo.city}
              </Button>
            )
          }
        >
          {switchTo
            ? `Vị trí GPS ở gần khu vực minh họa ${switchTo.city}. Các trạm đang ở ${area.city}.`
            : near.area.id === area.id
              ? `Các trạm ở ${area.city}. Bấm “Về bãi xe” để xem tuyến từ bãi.`
              : `Chưa có khu vực minh họa gần vị trí GPS này. Các trạm đang ở ${area.city}; bấm “Về bãi xe” để xem tuyến từ bãi.`}
        </Alert>
      )}

      <div className="-mx-4 mt-3 sm:mx-0">
        <RoadMap
          className="h-[44vh] min-h-[280px] max-h-[440px] sm:rounded sm:border sm:border-line"
          label="Bản đồ trạm thu gom, vị trí xe và đường đi tới trạm đang chọn"
          markers={markers}
          lines={lines}
          zone={state.settings.zone}
          fitKey={`${origin.lat},${origin.lng}|${selectedId}|${preview.value ? 'r' : '-'}`}
          fitPoints={preview.value ? preview.value.geometry : selected ? [origin, selected] : undefined}
          onMarkerClick={(id) => targets.some((t) => t.id === id) && setPicked(id)}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <ProviderNote provider={matrix.value?.provider ?? null} loading={matrix.loading} />
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="inline-block h-3 w-3 rounded-full border border-dashed border-forest bg-forest/5" aria-hidden />
          Phạm vi thu gom {String(state.settings.zone.radiusKm).replace('.', ',')} km
        </span>
      </div>

      {nextPlanned && route && (
        <Alert
          tone="info"
          icon="route"
          className="mt-4"
          title={`Tuyến ${route.id}: điểm tiếp theo theo kế hoạch là ${nextPlanned.stationId}`}
          actions={
            <a className="btn btn-primary btn-sm" href={`#driver-nav-${nextPlanned.stationId}`}>
              <Icon name="arrowRight" size={16} /> Dẫn đường theo tuyến
            </a>
          }
        >
          Thứ tự tuyến tính cho cả chuyến. Danh sách dưới đây chỉ xét trạm nhanh nhất từ chỗ xe đang đứng.
        </Alert>
      )}

      <h2 className="mt-5 text-sm font-semibold text-ink">Trong phạm vi thu gom</h2>
      {targets.length === 0 ? (
        <div className="mt-2">
          <EmptyState icon="checkCircle" title="Không có trạm nào cần thu gom">
            Không trạm nào đạt ngưỡng 80 % hoặc dự báo đạt ngưỡng trước chuyến kế tiếp.
          </EmptyState>
        </div>
      ) : !ranking ? (
        <div className="mt-2 flex flex-col gap-2" aria-busy>
          {targets.map((t) => (
            <Skeleton key={t.id} className="h-[76px]" />
          ))}
        </div>
      ) : (
        <>
          <ol className="mt-2 flex flex-col gap-2" aria-label="Trạm cần thu gom, nhanh nhất trước">
            {ranking.inZone.map((r, i) => (
              <TargetRow key={r.id} r={r} rank={i + 1} fastest={r.id === ranking.fastestId} selected={r.id === selectedId} onSelect={() => setPicked(r.id)} reason={reasons[r.reason] ?? (r.onRoute ? 'trên tuyến được giao' : r.reason)} />
            ))}
          </ol>
          {ranking.inZone.length === 0 && <p className="mt-2 text-sm text-muted">Không có trạm cần thu gom nào nằm trong phạm vi.</p>}
          {straightNote && (
            <p className="mt-2 flex gap-1.5 text-xs text-ink-2">
              <Icon name="info" size={14} className="mt-px text-muted" />
              {straightNote}
            </p>
          )}
          {ranking.outOfZone.length > 0 && (
            <>
              <h2 className="mt-5 text-sm font-semibold text-ink">Ngoài phạm vi thu gom</h2>
              <ul className="mt-1 text-sm text-ink-2">
                {ranking.outOfZone.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border-b border-line py-2 last:border-0">
                    <span>
                      <span className="id-tag font-semibold text-ink">{r.id}</span> {r.name}
                    </span>
                    <span className="tnum text-muted">{r.driveS != null ? fmtDurationVi(r.driveS) : '—'}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted">Người điều phối đổi phạm vi trong RE Hub → Cài đặt.</p>
            </>
          )}
        </>
      )}
    </DriverShell>
  );
}

function TargetRow({ r, rank, fastest, selected, onSelect, reason }: { r: Ranked; rank: number; fastest: boolean; selected: boolean; onSelect: () => void; reason: string }) {
  return (
    <li className={`rounded border bg-white ${selected ? 'border-route shadow-1' : 'border-line'}`}>
      <div className="flex items-start gap-3 p-3">
        <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-start gap-3 text-left">
          <span className={`tnum grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${fastest ? 'bg-route text-white' : 'border border-line-strong text-ink-2'}`}>{rank}</span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="id-tag font-semibold text-ink">{r.id}</span>
              <span className="truncate text-sm text-ink-2">{r.name}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <ClassBadge cls={r.cls} />
              <span className="tnum text-xs text-muted">
                {n0(r.fillPct)} % · {reason}
              </span>
              {r.stale && <StaleTag>số đo cũ</StaleTag>}
              {r.fault && <span className="text-xs font-medium text-fault-ink">Trạm đang lỗi</span>}
            </span>
          </span>
        </button>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="text-right">
            <span className={`tnum block text-base font-bold ${fastest ? 'text-route-ink' : 'text-ink'}`}>{r.driveS != null ? fmtDurationVi(r.driveS) : '—'}</span>
            <span className="tnum block text-xs text-muted">{r.driveM != null ? fmtDistanceVi(r.driveM) : 'không có đường'}</span>
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
        <span className="text-xs font-medium text-route-ink">{fastest ? 'Nhanh nhất từ vị trí xe' : ''}</span>
        <a href={`#driver-nav-${r.id}`} className={`btn btn-sm ${fastest ? 'btn-primary' : 'btn-secondary'}`} aria-label={`Dẫn đường tới ${r.id}`}>
          <Icon name="arrowRight" size={16} /> Dẫn đường
        </a>
      </div>
    </li>
  );
}
