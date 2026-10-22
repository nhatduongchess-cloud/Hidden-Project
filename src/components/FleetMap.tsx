import { useMemo } from 'react';
import { RoadMap, type MapMarker } from './LazyRoadMap';
import { useRoadRoute } from '../lib/roadHooks';
import type { FleetPlan, LivePosition } from '../integrations/fleet';
import { positionState } from '../integrations/fleet';
import { ProviderNote } from '../pages/driver/shared';

export function FleetMap({ plan, positions = {}, selected, now = Date.now() }: { plan: FleetPlan; positions?: Record<string, LivePosition>; selected?: string; now?: number }) {
  const route = plan.routes.find((r) => r.vehicle.id === selected) ?? plan.routes[0];
  const points = useMemo(() => route ? [plan.depot, ...route.stops, plan.destination] : [], [plan.depot, plan.destination, route]);
  const road = useRoadRoute(points);
  const markers: MapMarker[] = [
    { ...plan.depot, id: 'DEPOT', kind: 'depot', title: plan.depot.name, label: 'Bãi xe' },
    { ...plan.destination, id: 'PARTNER', kind: 'partner', title: plan.destination.name, label: 'Tiếp nhận' },
    ...(route?.stops ?? []).map((s, i): MapMarker => ({ ...s, id: s.id, kind: 'station', order: i + 1,
      tone: s.status === 'done' ? 'forest' : s.cls === 'priority' ? 'fault' : 'amber', label: s.id, title: `${s.id} · ${s.name}` })),
    ...Object.entries(positions).map(([id, p]): MapMarker => ({ id, kind: 'truck', lat: p.lat, lng: p.lng,
      heading: p.heading ?? undefined, label: id, title: `${id} · ${positionState(p, now)} · ±${Math.round(p.accuracy)} m`,
      tone: positionState(p, now) === 'Đang cập nhật' ? 'forest' : 'slate' })),
  ];
  return <div>
    <RoadMap markers={markers} lines={road.value ? [{ id: 'fleet-route', points: road.value.geometry, kind: road.value.provider === 'estimate' ? 'estimate' : 'route' }] : []}
      fitKey={`${plan.id ?? plan.planId}-${route?.vehicle.id}-${selected ?? ''}-${Object.keys(positions).sort().join(',')}`} label="Bản đồ đội xe và vị trí trực tiếp" className="h-[340px] w-full rounded" />
    <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted"><span>Tuyến đang xem: {route?.vehicle.id ?? 'Chưa có tuyến'}</span><ProviderNote provider={road.value?.provider ?? null} loading={road.loading} /></div>
  </div>;
}
