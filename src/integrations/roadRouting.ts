import { bearingDeg, decodePolyline, haversineM, type LatLng } from '../domain/geo';
import type { ManeuverKind, Modifier, NavStep, ProviderId, RoadRoute } from '../domain/nav';

/**
 * Road routing over OpenStreetMap data, requested from the viewer's browser.
 *
 * 1. Valhalla (FOSSGIS public server) with the truck profile: respects one-way streets, turn
 *    restrictions and tagged truck limits (height, weight, access) for a small truck.
 * 2. OSRM (project-osrm.org demo server) with the car profile, if Valhalla does not answer.
 * 3. A straight-line estimate, clearly labelled, if neither is reachable (offline, or a preview
 *    that blocks outside requests).
 *
 * Both servers are free public demos with fair-use limits; a real deployment would self-host
 * Valhalla or OSRM on the same OpenStreetMap data. No API key is used or needed.
 */

export const VALHALLA_URL = 'https://valhalla1.openstreetmap.de';
export const OSRM_URL = 'https://router.project-osrm.org';

/** Small collection truck (≤ 1 t payload) assumed by the proposal. Values are planning assumptions. */
export const TRUCK = { heightM: 2.5, widthM: 1.8, lengthM: 5.0, weightT: 2.8, axleLoadT: 1.8 };

export const PROVIDER_LABEL: Record<ProviderId, { name: string; profile: string; note: string }> = {
  valhalla: { name: 'Valhalla · OpenStreetMap', profile: 'Xe tải nhỏ', note: 'Theo đường một chiều, cấm rẽ và giới hạn xe tải có trong dữ liệu OSM.' },
  osrm: { name: 'OSRM · OpenStreetMap', profile: 'Ô tô', note: 'Chưa tính giới hạn riêng cho xe tải.' },
  estimate: { name: 'Ước tính đường thẳng', profile: 'Không có dữ liệu đường', note: 'Không kết nối được dịch vụ định tuyến. Quãng đường = đường thẳng × 1,35, tốc độ trung bình 20 km/h.' },
};

export const ROUTING_ATTRIBUTION =
  'Định tuyến: <a href="https://valhalla.github.io/valhalla/" target="_blank" rel="noopener">Valhalla</a> (FOSSGIS) / <a href="https://project-osrm.org/" target="_blank" rel="noopener">OSRM</a>';

export interface Matrix {
  provider: ProviderId;
  /** durationsS[i][j]: seconds from source i to target j, null if unreachable. */
  durationsS: (number | null)[][];
  distancesM: (number | null)[][];
}

export interface RoutingOptions {
  signal?: AbortSignal;
  /** Providers to try, in order. The estimate is always the last resort. */
  providers?: Exclude<ProviderId, 'estimate'>[];
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_PROVIDERS: Exclude<ProviderId, 'estimate'>[] = ['valhalla', 'osrm'];

/* ---------- Valhalla ---------- */

function valhallaCosting() {
  return {
    costing: 'truck',
    costing_options: {
      truck: { height: TRUCK.heightM, width: TRUCK.widthM, length: TRUCK.lengthM, weight: TRUCK.weightT, axle_load: TRUCK.axleLoadT },
    },
  };
}

export function valhallaRouteUrl(points: LatLng[]): string {
  const body = {
    locations: points.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lng.toFixed(6), type: 'break' })),
    ...valhallaCosting(),
    units: 'kilometers',
    directions_options: { units: 'kilometers', language: 'en-US' },
  };
  return `${VALHALLA_URL}/route?json=${encodeURIComponent(JSON.stringify(body))}`;
}

export function valhallaMatrixUrl(sources: LatLng[], targets: LatLng[]): string {
  const loc = (p: LatLng) => ({ lat: +p.lat.toFixed(6), lon: +p.lng.toFixed(6) });
  const body = { sources: sources.map(loc), targets: targets.map(loc), ...valhallaCosting(), units: 'kilometers' };
  return `${VALHALLA_URL}/sources_to_targets?json=${encodeURIComponent(JSON.stringify(body))}`;
}

/** Valhalla maneuver type numbers (valhalla/odin/maneuver.h, DirectionsLeg_Maneuver_Type). */
function valhallaManeuver(type: number): { kind: ManeuverKind; modifier?: Modifier } {
  switch (type) {
    case 1:
      return { kind: 'depart' };
    case 2:
      return { kind: 'depart', modifier: 'right' };
    case 3:
      return { kind: 'depart', modifier: 'left' };
    case 4:
      return { kind: 'arrive' };
    case 5:
      return { kind: 'arrive', modifier: 'right' };
    case 6:
      return { kind: 'arrive', modifier: 'left' };
    case 7:
      return { kind: 'name_change' };
    case 8:
      return { kind: 'continue' };
    case 9:
      return { kind: 'turn', modifier: 'slight_right' };
    case 10:
      return { kind: 'turn', modifier: 'right' };
    case 11:
      return { kind: 'turn', modifier: 'sharp_right' };
    case 12:
    case 13:
      return { kind: 'uturn', modifier: 'uturn' };
    case 14:
      return { kind: 'turn', modifier: 'sharp_left' };
    case 15:
      return { kind: 'turn', modifier: 'left' };
    case 16:
      return { kind: 'turn', modifier: 'slight_left' };
    case 17:
      return { kind: 'ramp', modifier: 'straight' };
    case 18:
    case 20:
      return { kind: 'ramp', modifier: 'right' };
    case 19:
    case 21:
      return { kind: 'ramp', modifier: 'left' };
    case 22:
      return { kind: 'fork', modifier: 'straight' };
    case 23:
      return { kind: 'fork', modifier: 'right' };
    case 24:
      return { kind: 'fork', modifier: 'left' };
    case 25:
    case 37:
    case 38:
      return { kind: 'merge' };
    case 26:
      return { kind: 'roundabout' };
    case 27:
      return { kind: 'exit_roundabout' };
    default:
      return { kind: 'continue' };
  }
}

interface ValhallaManeuver {
  type: number;
  street_names?: string[];
  begin_street_names?: string[];
  time: number;
  length: number;
  begin_shape_index: number;
  roundabout_exit_count?: number;
}
interface ValhallaLeg {
  maneuvers: ValhallaManeuver[];
  summary: { length: number; time: number };
  shape: string;
}

export function parseValhallaRoute(json: unknown): RoadRoute {
  const trip = (json as { trip?: { legs?: ValhallaLeg[]; summary?: { length: number; time: number }; status?: number; units?: string } }).trip;
  if (!trip?.legs?.length) throw new Error('valhalla: no trip');
  const kmFactor = trip.units === 'miles' ? 1609.344 : 1000;
  const geometry: LatLng[] = [];
  const steps: NavStep[] = [];
  const legEnds: number[] = [];
  const legs: RoadRoute['legs'] = [];
  trip.legs.forEach((leg, li) => {
    const shape = decodePolyline(leg.shape, 6);
    // Consecutive legs share their joining point; keep one copy.
    const offset = geometry.length === 0 ? 0 : geometry.length - 1;
    geometry.push(...(geometry.length === 0 ? shape : shape.slice(1)));
    leg.maneuvers.forEach((m) => {
      const k = valhallaManeuver(m.type);
      steps.push({
        ...k,
        exit: k.kind === 'roundabout' ? m.roundabout_exit_count ?? 1 : undefined,
        name: (m.street_names ?? m.begin_street_names ?? [])[0] ?? '',
        distanceM: m.length * kmFactor,
        durationS: m.time,
        at: offset + m.begin_shape_index,
        leg: li,
      });
    });
    legEnds.push(geometry.length - 1);
    legs.push({ distanceM: leg.summary.length * kmFactor, durationS: leg.summary.time });
  });
  return {
    provider: 'valhalla',
    profile: 'truck',
    distanceM: (trip.summary?.length ?? legs.reduce((s, l) => s + l.distanceM / kmFactor, 0)) * kmFactor,
    durationS: trip.summary?.time ?? legs.reduce((s, l) => s + l.durationS, 0),
    geometry,
    steps,
    legEnds,
    legs,
  };
}

export function parseValhallaMatrix(json: unknown, nSources: number, nTargets: number): Matrix {
  const j = json as { sources_to_targets?: unknown; units?: string };
  const kmFactor = j.units === 'miles' ? 1609.344 : 1000;
  const durationsS: (number | null)[][] = Array.from({ length: nSources }, () => Array(nTargets).fill(null));
  const distancesM: (number | null)[][] = Array.from({ length: nSources }, () => Array(nTargets).fill(null));
  const st = j.sources_to_targets;
  if (Array.isArray(st)) {
    // Verbose form: rows of { from_index, to_index, time, distance }.
    st.forEach((row: unknown, i: number) => {
      (row as { time: number | null; distance: number | null; to_index?: number; from_index?: number }[]).forEach((c, k) => {
        const from = c.from_index ?? i;
        const to = c.to_index ?? k;
        if (from < nSources && to < nTargets) {
          durationsS[from][to] = c.time ?? null;
          distancesM[from][to] = c.distance == null ? null : c.distance * kmFactor;
        }
      });
    });
  } else if (st && typeof st === 'object' && 'durations' in st) {
    // Concise form (verbose=false): parallel arrays.
    const c = st as { durations: (number | null)[][]; distances: (number | null)[][] };
    c.durations.forEach((r, i) => r.forEach((v, k) => (durationsS[i][k] = v)));
    c.distances.forEach((r, i) => r.forEach((v, k) => (distancesM[i][k] = v == null ? null : v * kmFactor)));
  } else throw new Error('valhalla: no matrix');
  return { provider: 'valhalla', durationsS, distancesM };
}

/* ---------- OSRM ---------- */

const lonlat = (pts: LatLng[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

export function osrmRouteUrl(points: LatLng[]): string {
  return `${OSRM_URL}/route/v1/driving/${lonlat(points)}?overview=full&geometries=polyline6&steps=true`;
}

export function osrmTableUrl(sources: LatLng[], targets: LatLng[]): string {
  const all = [...sources, ...targets];
  const src = sources.map((_, i) => i).join(';');
  const dst = targets.map((_, i) => i + sources.length).join(';');
  return `${OSRM_URL}/table/v1/driving/${lonlat(all)}?sources=${src}&destinations=${dst}&annotations=duration,distance`;
}

function osrmModifier(m?: string): Modifier | undefined {
  switch (m) {
    case 'left':
    case 'right':
    case 'straight':
    case 'uturn':
      return m;
    case 'slight left':
      return 'slight_left';
    case 'slight right':
      return 'slight_right';
    case 'sharp left':
      return 'sharp_left';
    case 'sharp right':
      return 'sharp_right';
    default:
      return undefined;
  }
}

function osrmKind(type: string, modifier?: Modifier): ManeuverKind {
  switch (type) {
    case 'depart':
      return 'depart';
    case 'arrive':
      return 'arrive';
    case 'turn':
    case 'end of road':
    case 'roundabout turn':
      return modifier === 'uturn' ? 'uturn' : modifier === 'straight' ? 'continue' : 'turn';
    case 'new name':
      return 'name_change';
    case 'merge':
      return 'merge';
    case 'on ramp':
    case 'off ramp':
      return 'ramp';
    case 'fork':
      return 'fork';
    case 'roundabout':
    case 'rotary':
      return 'roundabout';
    case 'exit roundabout':
    case 'exit rotary':
      return 'exit_roundabout';
    default:
      return 'continue';
  }
}

interface OsrmStep {
  distance: number;
  duration: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number]; exit?: number };
}

export function parseOsrmRoute(json: unknown): RoadRoute {
  const j = json as { code?: string; routes?: { distance: number; duration: number; geometry: string; legs: { distance: number; duration: number; steps: OsrmStep[] }[] }[] };
  const r = j.routes?.[0];
  if (j.code !== 'Ok' || !r) throw new Error(`osrm: ${j.code ?? 'no route'}`);
  const geometry = decodePolyline(r.geometry, 6);
  const steps: NavStep[] = [];
  const legEnds: number[] = [];
  let cursor = 0;
  // Place each maneuver on the overview geometry by walking forward to its nearest vertex.
  const locate = (loc: LatLng) => {
    let best = cursor;
    let bd = Infinity;
    for (let i = cursor; i < geometry.length; i++) {
      const d = haversineM(loc, geometry[i]);
      if (d < bd) (bd = d), (best = i);
      if (bd < 0.5) break;
      if (d > bd + 400) break;
    }
    cursor = best;
    return best;
  };
  r.legs.forEach((leg, li) => {
    leg.steps.forEach((s) => {
      const modifier = osrmModifier(s.maneuver.modifier);
      const kind = osrmKind(s.maneuver.type, modifier);
      const at = locate({ lat: s.maneuver.location[1], lng: s.maneuver.location[0] });
      steps.push({
        kind,
        modifier: kind === 'arrive' ? (modifier === 'left' || modifier === 'right' ? modifier : undefined) : modifier,
        exit: kind === 'roundabout' ? s.maneuver.exit ?? 1 : undefined,
        name: s.name ?? '',
        distanceM: s.distance,
        durationS: s.duration,
        at,
        leg: li,
      });
    });
    legEnds.push(li === r.legs.length - 1 ? geometry.length - 1 : cursor);
  });
  return {
    provider: 'osrm',
    profile: 'car',
    distanceM: r.distance,
    durationS: r.duration,
    geometry,
    steps,
    legEnds,
    legs: r.legs.map((l) => ({ distanceM: l.distance, durationS: l.duration })),
  };
}

export function parseOsrmTable(json: unknown): Matrix {
  const j = json as { code?: string; durations?: (number | null)[][]; distances?: (number | null)[][] };
  if (j.code !== 'Ok' || !j.durations) throw new Error(`osrm table: ${j.code ?? 'no data'}`);
  return { provider: 'osrm', durationsS: j.durations, distancesM: j.distances ?? j.durations.map((r) => r.map(() => null)) };
}

/* ---------- Straight-line estimate ---------- */

export const DETOUR_FACTOR = 1.35;
/** Same as the planner's default average speed, so both estimates agree. */
export const ESTIMATE_KMH = 20;

export function estimateRoute(points: LatLng[]): RoadRoute {
  const steps: NavStep[] = [];
  const legs: RoadRoute['legs'] = [];
  const legEnds: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const d = haversineM(points[i], points[i + 1]) * DETOUR_FACTOR;
    const t = d / ((ESTIMATE_KMH * 1000) / 3600);
    const turn = i === 0 ? 0 : ((bearingDeg(points[i], points[i + 1]) - bearingDeg(points[i - 1], points[i]) + 540) % 360) - 180;
    steps.push({ kind: 'depart', modifier: turn < -20 ? 'left' : turn > 20 ? 'right' : undefined, name: '', distanceM: d, durationS: t, at: i, leg: i });
    steps.push({ kind: 'arrive', name: '', distanceM: 0, durationS: 0, at: i + 1, leg: i });
    legs.push({ distanceM: d, durationS: t });
    legEnds.push(i + 1);
  }
  return {
    provider: 'estimate',
    profile: 'straight',
    distanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    durationS: legs.reduce((s, l) => s + l.durationS, 0),
    geometry: points.slice(),
    steps,
    legEnds,
    legs,
  };
}

export function estimateMatrix(sources: LatLng[], targets: LatLng[]): Matrix {
  const distancesM = sources.map((s) => targets.map((t) => haversineM(s, t) * DETOUR_FACTOR));
  return { provider: 'estimate', distancesM, durationsS: distancesM.map((r) => r.map((d) => (d == null ? null : d / ((ESTIMATE_KMH * 1000) / 3600)))) };
}

/* ---------- Requests with fallback ---------- */

async function getJson(url: string, opts: RoutingOptions): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 9000);
  const onAbort = () => ctrl.abort();
  opts.signal?.addEventListener('abort', onAbort);
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export interface Fetched<T> {
  value: T;
  /** Providers that were tried and failed before this one, with the reason. */
  failed: { provider: ProviderId; error: string }[];
}

const routeCache = new Map<string, Fetched<RoadRoute>>();
const matrixCache = new Map<string, Fetched<Matrix>>();
const key = (pts: LatLng[]) => pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

export function clearRoutingCache() {
  routeCache.clear();
  matrixCache.clear();
}

export async function fetchRoute(points: LatLng[], opts: RoutingOptions = {}): Promise<Fetched<RoadRoute>> {
  if (points.length < 2) throw new Error('need two points');
  const k = key(points);
  const hit = routeCache.get(k);
  if (hit) return hit;
  const failed: Fetched<RoadRoute>['failed'] = [];
  for (const p of opts.providers ?? DEFAULT_PROVIDERS) {
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    try {
      const json = await getJson(p === 'valhalla' ? valhallaRouteUrl(points) : osrmRouteUrl(points), opts);
      const value = p === 'valhalla' ? parseValhallaRoute(json) : parseOsrmRoute(json);
      const out = { value, failed };
      routeCache.set(k, out);
      return out;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      failed.push({ provider: p, error: e instanceof Error ? e.message : String(e) });
    }
  }
  // Not cached, so the next request tries the real services again.
  return { value: estimateRoute(points), failed };
}

export async function fetchMatrix(sources: LatLng[], targets: LatLng[], opts: RoutingOptions = {}): Promise<Fetched<Matrix>> {
  const k = `${key(sources)}>${key(targets)}`;
  const hit = matrixCache.get(k);
  if (hit) return hit;
  const failed: Fetched<Matrix>['failed'] = [];
  for (const p of opts.providers ?? DEFAULT_PROVIDERS) {
    if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    try {
      const json = await getJson(p === 'valhalla' ? valhallaMatrixUrl(sources, targets) : osrmTableUrl(sources, targets), opts);
      const value = p === 'valhalla' ? parseValhallaMatrix(json, sources.length, targets.length) : parseOsrmTable(json);
      const out = { value, failed };
      matrixCache.set(k, out);
      return out;
    } catch (e) {
      if (opts.signal?.aborted) throw e;
      failed.push({ provider: p, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { value: estimateMatrix(sources, targets), failed };
}
