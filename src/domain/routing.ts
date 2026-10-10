import type { AccessWindow } from './types';

/**
 * Illustrative collection routing. Distances are a fixed mock matrix (km), not road data.
 * The planner is a transparent local heuristic: classify stops, select within capacity,
 * then enumerate visiting orders (exhaustive up to 7 stops) and keep the best feasible one.
 * It makes no claim of global optimality and models no real traffic restrictions.
 */

export const DEPOT = 'DEPOT';
export const PARTNER = 'PARTNER';

export const MOCK_DISTANCE_KM: Record<string, Record<string, number>> = {
  DEPOT: { 'RE-001': 8.2, 'RE-002': 6.5, 'RE-003': 8.8, PARTNER: 11.6 },
  'RE-001': { 'RE-002': 1.4, 'RE-003': 0.6, PARTNER: 12.9 },
  'RE-002': { 'RE-003': 1.8, PARTNER: 14.6 },
  'RE-003': { PARTNER: 12.2 },
};

export function dist(a: string, b: string): number {
  if (a === b) return 0;
  return MOCK_DISTANCE_KM[a]?.[b] ?? MOCK_DISTANCE_KM[b]?.[a] ?? Infinity;
}

export interface PlanStationInput {
  id: string;
  currentPct: number;
  forecastPct: number;
  /** Estimated mass in the bin from station records, kg. */
  massKg: number;
  window: AccessWindow;
}

export interface PlanConfig {
  departure: string; // HH:MM
  shiftEnd: string; // HH:MM, must return by then
  payloadKg: number;
  cargoVolumeM3: number;
  binVolumeM3: number;
  serviceMin: number;
  speedKmh: number;
  thresholdPct: number;
  stopPct: number;
  includeNearby: boolean;
  nearbyMinPct: number;
  maxDetourKm: number;
  endAt: typeof DEPOT | typeof PARTNER;
}

export type StopClass = 'priority' | 'required' | 'optional' | 'skipped';

export interface Candidate {
  id: string;
  cls: StopClass;
  reason: string;
  st: PlanStationInput;
}

export interface StopEval {
  id: string;
  arriveMin: number;
  waitMin: number;
  departMin: number;
  window: AccessWindow;
  late: boolean;
  massKg: number;
  legKm: number;
}

export interface RouteEval {
  order: string[];
  stops: StopEval[];
  distanceKm: number;
  durationMin: number;
  collectedKg: number;
  kgPerKm: number;
  finishMin: number;
  violations: string[];
}

export interface PlanResult {
  candidates: Candidate[];
  selected: string[];
  planned: RouteEval | null;
  baseline: RouteEval | null;
  feasible: boolean;
  issues: string[];
}

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function fmtMin(min: number): string {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function classify(st: PlanStationInput, cfg: PlanConfig): Candidate {
  if (st.currentPct >= cfg.stopPct) return { id: st.id, cls: 'priority', reason: 'at_stop', st };
  if (st.currentPct >= cfg.thresholdPct) return { id: st.id, cls: 'required', reason: 'at_threshold', st };
  if (st.forecastPct >= cfg.thresholdPct) return { id: st.id, cls: 'required', reason: 'forecast_threshold', st };
  if (cfg.includeNearby && st.currentPct >= cfg.nearbyMinPct) return { id: st.id, cls: 'optional', reason: 'nearby', st };
  return { id: st.id, cls: 'skipped', reason: cfg.includeNearby ? 'below_nearby' : 'below_threshold', st };
}

export function evaluate(order: string[], stations: Map<string, PlanStationInput>, cfg: PlanConfig): RouteEval {
  let t = toMin(cfg.departure);
  let at = DEPOT;
  let km = 0;
  let kg = 0;
  const stops: StopEval[] = [];
  const violations: string[] = [];
  for (const id of order) {
    const st = stations.get(id)!;
    const leg = dist(at, id);
    km += leg;
    t += (leg / cfg.speedKmh) * 60;
    const open = toMin(st.window.start);
    const close = toMin(st.window.end);
    const wait = Math.max(0, open - t);
    const arrive = t;
    t += wait;
    const late = t > close;
    if (late) violations.push(`window:${id}`);
    t += cfg.serviceMin;
    kg += st.massKg;
    stops.push({ id, arriveMin: arrive, waitMin: wait, departMin: t, window: st.window, late, massKg: st.massKg, legKm: leg });
    at = id;
  }
  const last = dist(at, cfg.endAt);
  km += last;
  t += (last / cfg.speedKmh) * 60;
  if (t > toMin(cfg.shiftEnd)) violations.push('shift_end');
  if (kg > cfg.payloadKg) violations.push('payload');
  if (order.length * cfg.binVolumeM3 > cfg.cargoVolumeM3 + 1e-9) violations.push('volume');
  return {
    order,
    stops,
    distanceKm: km,
    durationMin: t - toMin(cfg.departure),
    collectedKg: kg,
    kgPerKm: km > 0 ? kg / km : 0,
    finishMin: t,
    violations,
  };
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr.slice()];
  const out: T[][] = [];
  arr.forEach((x, i) => {
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)])) out.push([x, ...p]);
  });
  return out;
}

function nearestNeighbour(ids: string[], cfg: PlanConfig): string[] {
  const left = new Set(ids);
  const out: string[] = [];
  let at = DEPOT;
  while (left.size) {
    let best = '';
    let bd = Infinity;
    for (const id of left) if (dist(at, id) < bd) (bd = dist(at, id)), (best = id);
    out.push(best);
    left.delete(best);
    at = best;
  }
  void cfg;
  return out;
}

function better(a: RouteEval, b: RouteEval | null): boolean {
  if (!b) return true;
  if (a.violations.length !== b.violations.length) return a.violations.length < b.violations.length;
  return a.distanceKm < b.distanceKm - 1e-9;
}

function bestOrder(ids: string[], stations: Map<string, PlanStationInput>, cfg: PlanConfig): RouteEval {
  const orders = ids.length <= 7 ? permutations(ids) : [nearestNeighbour(ids, cfg)];
  let best: RouteEval | null = null;
  for (const o of orders) {
    const e = evaluate(o, stations, cfg);
    if (better(e, best)) best = e;
  }
  return best!;
}

const RANK: Record<StopClass, number> = { priority: 0, required: 1, optional: 2, skipped: 3 };

export function planRoute(input: PlanStationInput[], cfg: PlanConfig): PlanResult {
  const stations = new Map(input.map((s) => [s.id, s]));
  const candidates = input.map((s) => classify(s, cfg)).sort((a, b) => RANK[a.cls] - RANK[b.cls] || b.st.currentPct - a.st.currentPct);
  const issues: string[] = [];

  // Capacity selection: priority first, then required, then optional, each by fill descending.
  const maxBins = Math.floor((cfg.cargoVolumeM3 + 1e-9) / cfg.binVolumeM3);
  const mandatory: string[] = [];
  let kg = 0;
  for (const c of candidates.filter((c) => c.cls === 'priority' || c.cls === 'required')) {
    if (mandatory.length + 1 > maxBins) {
      issues.push(`volume_required:${c.id}`);
      continue;
    }
    if (kg + c.st.massKg > cfg.payloadKg) {
      issues.push(`payload_required:${c.id}`);
      continue;
    }
    mandatory.push(c.id);
    kg += c.st.massKg;
  }

  if (mandatory.length === 0 && !candidates.some((c) => c.cls === 'optional')) {
    return { candidates, selected: [], planned: null, baseline: null, feasible: issues.length === 0, issues: issues.length ? issues : ['no_stops'] };
  }

  let planned = mandatory.length ? bestOrder(mandatory, stations, cfg) : null;
  // Optional nearby stops: add one at a time if capacity, time windows and the detour limit allow.
  for (const c of candidates.filter((c) => c.cls === 'optional')) {
    const current = planned?.order ?? [];
    if (current.length + 1 > maxBins) {
      c.reason = 'nearby_no_volume';
      continue;
    }
    if (kg + c.st.massKg > cfg.payloadKg) {
      c.reason = 'nearby_no_payload';
      continue;
    }
    const trial = bestOrder([...current, c.id], stations, cfg);
    const baseKm = planned ? planned.distanceKm : dist(DEPOT, cfg.endAt);
    const baseViol = planned ? planned.violations.length : 0;
    if (trial.violations.length > baseViol) {
      c.reason = 'nearby_no_time';
      continue;
    }
    if (trial.distanceKm - baseKm > cfg.maxDetourKm) {
      c.reason = 'nearby_detour';
      continue;
    }
    planned = trial;
    kg += c.st.massKg;
    c.reason = 'nearby_added';
  }

  if (!planned) return { candidates, selected: [], planned: null, baseline: null, feasible: issues.length === 0, issues: issues.length ? issues : ['no_stops'] };

  // Baseline: same stops, fixed station-id order, same constraints.
  const baseline = evaluate([...planned.order].sort(), stations, cfg);
  const feasible = issues.length === 0 && planned.violations.length === 0;
  return { candidates, selected: planned.order, planned, baseline, feasible, issues: [...issues, ...planned.violations] };
}
