import { cumulative, fmtDistanceVi, snapToLine, type LatLng } from './geo';

/**
 * Turn-by-turn navigation model shared by every routing source.
 * A route is one polyline with maneuvers placed on it; progress is computed by snapping the
 * vehicle's position onto that polyline, the same way phone navigation apps do.
 */

export type ProviderId = 'valhalla' | 'osrm' | 'estimate';

export type ManeuverKind =
  | 'depart'
  | 'arrive'
  | 'turn'
  | 'continue'
  | 'name_change'
  | 'uturn'
  | 'roundabout'
  | 'exit_roundabout'
  | 'merge'
  | 'ramp'
  | 'fork';

export type Modifier = 'left' | 'right' | 'slight_left' | 'slight_right' | 'sharp_left' | 'sharp_right' | 'straight' | 'uturn';

export interface NavStep {
  kind: ManeuverKind;
  modifier?: Modifier;
  /** Roundabout exit number, 1-based. */
  exit?: number;
  /** Street the maneuver leads onto ('' when the road has no name). */
  name: string;
  /** Length of road from this maneuver to the next one, metres. */
  distanceM: number;
  durationS: number;
  /** Index in the route geometry where the maneuver happens. */
  at: number;
  /** Which leg (between consecutive waypoints) the step belongs to. */
  leg: number;
}

export interface RoadRoute {
  provider: ProviderId;
  /** What the distances assume: a truck profile, a car profile, or straight lines. */
  profile: 'truck' | 'car' | 'straight';
  distanceM: number;
  durationS: number;
  geometry: LatLng[];
  steps: NavStep[];
  /** Geometry index where each leg ends (the last point of leg i). */
  legEnds: number[];
  legs: { distanceM: number; durationS: number }[];
}

/* ---------- Vietnamese instructions ---------- */

const SIDE: Record<Modifier, string> = {
  left: 'trái',
  right: 'phải',
  slight_left: 'trái',
  slight_right: 'phải',
  sharp_left: 'trái',
  sharp_right: 'phải',
  straight: 'thẳng',
  uturn: '',
};

function onto(name: string, prep = 'vào'): string {
  return name ? ` ${prep} ${name}` : '';
}

/** Full instruction, as read on the banner: "Rẽ phải vào Đường Tạ Quang Bửu". */
export function instructionVi(s: NavStep, destination?: string): string {
  const m = s.modifier ?? 'straight';
  switch (s.kind) {
    case 'depart':
      return s.name ? `Xuất phát theo ${s.name}` : 'Xuất phát';
    case 'arrive': {
      const where = destination ? `Đến ${destination}` : 'Đến điểm đến';
      return m === 'left' || m === 'right' ? `${where}, ở bên ${SIDE[m]}` : where;
    }
    case 'uturn':
      return `Quay đầu${onto(s.name)}`;
    case 'turn':
      if (m === 'uturn') return `Quay đầu${onto(s.name)}`;
      if (m === 'straight') return `Đi thẳng${onto(s.name)}`;
      if (m === 'slight_left' || m === 'slight_right') return `Chếch sang ${SIDE[m]}${onto(s.name)}`;
      if (m === 'sharp_left' || m === 'sharp_right') return `Rẽ gắt sang ${SIDE[m]}${onto(s.name)}`;
      return `Rẽ ${SIDE[m]}${onto(s.name)}`;
    case 'continue':
      return s.name ? `Tiếp tục đi trên ${s.name}` : 'Tiếp tục đi thẳng';
    case 'name_change':
      return s.name ? `Đi tiếp vào ${s.name}` : 'Tiếp tục đi thẳng';
    case 'roundabout':
      return `Vào vòng xuyến, đi theo lối ra thứ ${s.exit ?? 1}${onto(s.name)}`;
    case 'exit_roundabout':
      return `Ra khỏi vòng xuyến${onto(s.name)}`;
    case 'merge':
      return `Nhập làn${onto(s.name)}`;
    case 'ramp':
      return m === 'straight' ? `Đi theo đường nhánh${onto(s.name)}` : `Đi theo đường nhánh bên ${SIDE[m]}${onto(s.name)}`;
    case 'fork':
      return m === 'straight' ? `Đi thẳng ở chỗ rẽ nhánh${onto(s.name)}` : `Giữ bên ${SIDE[m]} ở chỗ rẽ nhánh${onto(s.name)}`;
  }
}

/** Short form for the "Sau đó" chip: "Rẽ trái". */
export function shortInstructionVi(s: NavStep): string {
  const m = s.modifier ?? 'straight';
  if (s.kind === 'arrive') return 'Đến nơi';
  if (s.kind === 'roundabout') return `Vòng xuyến, lối ${s.exit ?? 1}`;
  if (s.kind === 'uturn' || m === 'uturn') return 'Quay đầu';
  if (s.kind === 'turn') return m === 'straight' ? 'Đi thẳng' : m.startsWith('slight') ? `Chếch ${SIDE[m]}` : `Rẽ ${SIDE[m]}`;
  if (s.kind === 'fork' || s.kind === 'ramp') return m === 'straight' ? 'Đi thẳng' : `Giữ ${SIDE[m]}`;
  return 'Đi thẳng';
}

/** Which arrow the banner draws. */
export type ArrowIcon = 'straight' | 'left' | 'right' | 'slight_left' | 'slight_right' | 'sharp_left' | 'sharp_right' | 'uturn' | 'roundabout' | 'arrive' | 'depart' | 'merge';
export function arrowFor(s: NavStep): ArrowIcon {
  if (s.kind === 'arrive') return 'arrive';
  if (s.kind === 'depart') return 'depart';
  if (s.kind === 'roundabout' || s.kind === 'exit_roundabout') return 'roundabout';
  if (s.kind === 'uturn' || s.modifier === 'uturn') return 'uturn';
  if (s.kind === 'merge') return 'merge';
  if (s.kind === 'continue' || s.kind === 'name_change') return 'straight';
  return (s.modifier as ArrowIcon) ?? 'straight';
}

/* ---------- Progress along a route ---------- */

export interface Prepared {
  route: RoadRoute;
  cum: number[];
  /** Distance along the geometry where each step's maneuver happens. */
  stepAlong: number[];
  /** Distance along the geometry where each leg ends. */
  legAlong: number[];
}

export function prepare(route: RoadRoute): Prepared {
  const cum = cumulative(route.geometry);
  return {
    route,
    cum,
    stepAlong: route.steps.map((s) => cum[Math.min(s.at, cum.length - 1)] ?? 0),
    legAlong: route.legEnds.map((i) => cum[Math.min(i, cum.length - 1)] ?? 0),
  };
}

export interface NavProgress {
  along: number;
  /** Index of the next maneuver the driver has not reached yet. */
  next: number;
  distToNextM: number;
  remainingM: number;
  remainingS: number;
  /** Distance from the vehicle to the route line, metres. */
  offRouteM: number;
  leg: number;
  remainingLegM: number;
  arrived: boolean;
  point: LatLng;
  segIndex: number;
}

/** Below this distance to the end, the vehicle has arrived. */
export const ARRIVE_M = 30;
/** Further than this from the line counts as off the route. */
export const OFF_ROUTE_M = 45;

/**
 * Where the vehicle is on the route. `minAlong` keeps progress monotonic so that a position near
 * a road the route uses twice is matched to the later pass.
 */
export function progress(p: Prepared, pos: LatLng, minAlong = 0): NavProgress {
  const { route, cum, stepAlong, legAlong } = p;
  const total = cum[cum.length - 1] ?? 0;
  // Search from slightly behind the last known position.
  let from = 0;
  while (from < cum.length - 2 && cum[from + 1] < minAlong - 60) from++;
  const snap = snapToLine(route.geometry, cum, pos, from);
  const along = Math.max(snap.along, Math.min(minAlong, total));
  let next = stepAlong.findIndex((a, i) => i > 0 && a > along + 3);
  if (next < 0) next = route.steps.length - 1;
  const distToNextM = Math.max(0, stepAlong[next] - along);
  const remainingM = Math.max(0, total - along);
  // Time: whole steps after the current one plus the unfinished part of the current step.
  let remainingS = 0;
  for (let i = 0; i < route.steps.length; i++) {
    const start = stepAlong[i];
    const end = i + 1 < stepAlong.length ? stepAlong[i + 1] : total;
    if (end <= along) continue;
    const len = Math.max(1, end - start);
    const frac = start >= along ? 1 : (end - along) / len;
    remainingS += route.steps[i].durationS * frac;
  }
  let leg = legAlong.findIndex((a) => a > along + 1);
  if (leg < 0) leg = legAlong.length - 1;
  const remainingLegM = Math.max(0, (legAlong[leg] ?? total) - along);
  return {
    along,
    next,
    distToNextM,
    remainingM,
    remainingS,
    offRouteM: snap.offM,
    leg,
    remainingLegM,
    arrived: remainingM <= ARRIVE_M,
    point: snap.point,
    segIndex: snap.index,
  };
}

/** "Sau 200 m, rẽ phải vào …" for screen readers and the steps list. */
export function spokenVi(distM: number, s: NavStep, destination?: string): string {
  const text = instructionVi(s, destination);
  return `Sau ${fmtDistanceVi(distM)}, ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}
