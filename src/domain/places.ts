import type { AppState, FaultKind } from './types';
import { classify, DEPOT, PARTNER, type StopClass } from './routing';
import { defaultDispatchConfig, planInputs } from './dispatch';
import { activeRoute, stationOps } from './ops';
import { haversineM, inZone, type LatLng } from './geo';

/**
 * Places on the road map and the "nearest station" ranking for the driver.
 * Nearest means fastest to reach by road from where the truck is now, not closest as the crow
 * flies: a station across a canal or behind a one-way street can be near and still slow.
 */

export interface MapPoint extends LatLng {
  id: string;
  name: string;
  kind: 'station' | 'depot' | 'partner';
}

/** A planner id (station id, DEPOT or PARTNER) as a point on the map. */
export function pointOf(state: AppState, id: string): MapPoint | null {
  if (id === DEPOT) return { id, kind: 'depot', ...state.settings.depot };
  if (id === PARTNER) return { id, kind: 'partner', ...state.settings.partner };
  const st = state.stations.find((s) => s.id === id);
  return st ? { id, kind: 'station', name: st.name, lat: st.lat, lng: st.lng } : null;
}

/** Within this distance the truck counts as being at a place. */
const AT_PLACE_M = 25;

/** Where the truck is, in words: "Tại RE-003 · Thư viện trung tâm", the depot, or coordinates. */
export function truckLabel(state: AppState): string {
  const p = state.driverPos;
  const { depot, partner } = state.settings;
  if (!p || haversineM(p, depot) < AT_PLACE_M) return depot.name;
  const st = state.stations.find((s) => haversineM(s, p) < AT_PLACE_M);
  if (st) return `Tại ${st.id} · ${st.name}`;
  if (haversineM(p, partner) < AT_PLACE_M) return partner.name;
  return `Vị trí cuối ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}

/** Where the truck is: its last known position, otherwise the depot. */
export function truckPos(state: AppState): LatLng {
  return state.driverPos ?? { lat: state.settings.depot.lat, lng: state.settings.depot.lng };
}

export interface CollectTarget extends LatLng {
  id: string;
  name: string;
  site: string;
  cls: Exclude<StopClass, 'skipped'>;
  /** Planner reason: at_stop, at_threshold, forecast_threshold, nearby, on_route. */
  reason: string;
  /** Fill as last received by RE Hub. */
  fillPct: number;
  stale: boolean;
  fault: FaultKind | null;
  inZone: boolean;
  /** A pending stop on the route the driver is working. */
  onRoute: boolean;
}

/**
 * Stations the truck should visit: the planner's priority, required and nearby stops, plus any
 * pending stop on the active route. A faulted station is kept (its bin can still be swapped) and
 * flagged so the driver knows a technician is also needed.
 */
export function collectTargets(state: AppState, now = Date.now()): CollectTarget[] {
  const cfg = defaultDispatchConfig(state);
  const inputs = new Map(planInputs(state, cfg.nextHours).map((p) => [p.id, p]));
  const route = activeRoute(state);
  const pending = new Set(route?.stops.filter((s) => s.status === 'pending').map((s) => s.stationId) ?? []);
  const out: CollectTarget[] = [];
  for (const st of state.stations) {
    const input = inputs.get(st.id);
    if (!input) continue;
    const c = classify(input, cfg);
    const onRoute = pending.has(st.id);
    if (c.cls === 'skipped' && !onRoute) continue;
    const ops = stationOps(state, st, now);
    out.push({
      id: st.id,
      name: st.name,
      site: st.site,
      lat: st.lat,
      lng: st.lng,
      cls: c.cls === 'skipped' ? 'optional' : c.cls,
      reason: c.cls === 'skipped' ? 'on_route' : c.reason,
      fillPct: ops.hubFillPct,
      stale: ops.stale,
      fault: st.fault,
      inZone: inZone(st, state.settings.zone),
      onRoute,
    });
  }
  return out;
}

export interface Ranked extends CollectTarget {
  /** Road travel time and distance from the truck, null when the service found no road path. */
  driveS: number | null;
  driveM: number | null;
  straightM: number;
}

export interface Ranking {
  /** Inside the collection zone, fastest first. */
  inZone: Ranked[];
  outOfZone: Ranked[];
  fastestId: string | null;
  /** Closest as the crow flies, to explain when it is not the fastest by road. */
  straightNearestId: string | null;
}

/** Rank targets by travel time from `origin`. `durationsS[i]` / `distancesM[i]` belong to `targets[i]`. */
export function rankNearest(origin: LatLng, targets: CollectTarget[], durationsS: (number | null)[], distancesM: (number | null)[]): Ranking {
  const all: Ranked[] = targets.map((t, i) => ({
    ...t,
    driveS: durationsS[i] ?? null,
    driveM: distancesM[i] ?? null,
    straightM: haversineM(origin, t),
  }));
  const byTime = (a: Ranked, b: Ranked) =>
    (a.driveS ?? Infinity) - (b.driveS ?? Infinity) || (a.driveM ?? Infinity) - (b.driveM ?? Infinity) || a.straightM - b.straightM;
  const zone = all.filter((r) => r.inZone).sort(byTime);
  const fastest = zone.find((r) => r.driveS != null) ?? null;
  const straight = zone.slice().sort((a, b) => a.straightM - b.straightM)[0] ?? null;
  return {
    inZone: zone,
    outOfZone: all.filter((r) => !r.inZone).sort(byTime),
    fastestId: fastest?.id ?? null,
    straightNearestId: straight?.id ?? null,
  };
}
