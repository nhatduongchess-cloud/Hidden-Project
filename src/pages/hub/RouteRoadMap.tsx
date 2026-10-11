import { useAppState } from '../../lib/store-context';
import { collectTargets, pointOf, truckLabel } from '../../domain/places';
import type { LatLng } from '../../domain/geo';
import { useRoadRoute } from '../../lib/roadHooks';
import { RoadMap, type MapLine, type MapMarker } from '../../components/LazyRoadMap';
import { ProviderNote, placeMarkers } from '../driver/shared';

/** A collection route on the road map: planned order in blue, the comparison order dashed. */
export function RouteRoadMap({
  order,
  baseline,
  label,
  truck,
  className = 'h-[340px]',
  showProvider = true,
}: {
  order: string[];
  baseline?: string[];
  label: string;
  truck?: LatLng | null;
  className?: string;
  /** Off when the page already says where the numbers come from. */
  showProvider?: boolean;
}) {
  const state = useAppState();
  const pts = (ids: string[]) => ids.map((id) => pointOf(state, id)).filter((p): p is NonNullable<typeof p> => !!p).map(({ lat, lng }) => ({ lat, lng }));
  const sameAsPlanned = !baseline || baseline.join() === order.join();
  const planned = useRoadRoute(order.length >= 2 ? pts(order) : null);
  const base = useRoadRoute(!sameAsPlanned && baseline ? pts(baseline) : null);
  const stops = order.filter((id) => id !== 'DEPOT' && id !== 'PARTNER');
  const markers: MapMarker[] = placeMarkers(state, collectTargets(state), { order: Object.fromEntries(stops.map((id, i) => [id, i + 1])) });
  if (truck) markers.push({ id: 'TRUCK', kind: 'truck', ...truck, title: `Xe thu gom · ${truckLabel(state)}` });
  const lines: MapLine[] = [];
  if (base.value) lines.push({ id: 'baseline', kind: 'baseline', points: base.value.geometry });
  if (planned.value) lines.push({ id: 'planned', kind: planned.value.provider === 'estimate' ? 'estimate' : 'route', points: planned.value.geometry });
  return (
    <div className="min-w-0">
      <RoadMap
        className={`rounded border border-line ${className}`}
        label={label}
        markers={markers}
        lines={lines}
        zone={state.settings.zone}
        fitKey={`${state.settings.areaId}|${order.join('>')}|${planned.value ? 'r' : '-'}`}
        fitPoints={planned.value?.geometry}
      />
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full bg-route" /> Tuyến đề xuất
        </span>
        {!sameAsPlanned && (
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-2 border-dashed border-muted" /> Thứ tự cố định
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-dashed border-forest bg-forest/5" /> Phạm vi thu gom
        </span>
        {truck && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-route ring-2 ring-route/20" /> Xe
          </span>
        )}
      </div>
      {showProvider && (
        <div className="mt-1">
          <ProviderNote provider={planned.value?.provider ?? null} loading={planned.loading} />
        </div>
      )}
    </div>
  );
}
