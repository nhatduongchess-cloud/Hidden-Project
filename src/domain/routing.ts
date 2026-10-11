import type { AccessWindow } from './types';

/**
 * Collection routing. Distances come from road data when a routing service answers (see
 * integrations/roadRouting.ts), otherwise from a fixed mock matrix (km).
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

/**
 * Distance and travel time between two planner points (DEPOT, PARTNER or a station id).
 * The default is the mock matrix at the configured average speed; RE Hub swaps in road
 * distances and truck travel times when a routing service answers.
 */
export interface Metric {
  /** mock: fixed illustrative matrix; road: a routing service; estimate: straight lines × detour factor. */
  source: 'mock' | 'road' | 'estimate';
  km(a: string, b: string): number;
  minutes(a: string, b: string, cfg: PlanConfig): number;
}

export const MOCK_METRIC: Metric = {
  source: 'mock',
  km: dist,
  minutes: (a, b, cfg) => (dist(a, b) / cfg.speedKmh) * 60,
};

/** Build a metric from a square matrix over `ids` (seconds and metres). Missing cells fall back to the mock. */
export function matrixMetric(ids: string[], durationsS: (number | null)[][], distancesM: (number | null)[][], source: 'road' | 'estimate' = 'road'): Metric {
  const ix = new Map(ids.map((id, i) => [id, i]));
  const cell = <T,>(m: (T | null)[][], a: string, b: string): T | null => {
    const i = ix.get(a);
    const j = ix.get(b);
    return i === undefined || j === undefined ? null : m[i]?.[j] ?? null;
  };
  return {
    source,
    km: (a, b) => (a === b ? 0 : (cell(distancesM, a, b) ?? dist(a, b) * 1000) / 1000),
    // A straight-line estimate has no real travel times: it uses the planner's average speed.
    minutes: (a, b, cfg) => {
      if (a === b) return 0;
      const d = cell(durationsS, a, b);
      if (source === 'road' && d != null) return d / 60;
      const m = cell(distancesM, a, b);
      return ((m != null ? m / 1000 : dist(a, b)) / cfg.speedKmh) * 60;
    },
  };
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
  /** Where distances and times came from. */
  metric: Metric['source'];
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

export function evaluate(order: string[], stations: Map<string, PlanStationInput>, cfg: PlanConfig, metric: Metric = MOCK_METRIC): RouteEval {
  let t = toMin(cfg.departure);
  let at = DEPOT;
  let km = 0;
  let kg = 0;
  const stops: StopEval[] = [];
  const violations: string[] = [];
  for (const id of order) {
    const st = stations.get(id)!;
    const leg = metric.km(at, id);
    km += leg;
    t += metric.minutes(at, id, cfg);
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
  km += metric.km(at, cfg.endAt);
  t += metric.minutes(at, cfg.endAt, cfg);
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

function nearestNeighbour(ids: string[], cfg: PlanConfig, metric: Metric): string[] {
  const left = new Set(ids);
  const out: string[] = [];
  let at = DEPOT;
  while (left.size) {
    let best = '';
    let bd = Infinity;
    for (const id of left) {
      const d = metric.minutes(at, id, cfg);
      if (d < bd) (bd = d), (best = id);
    }
    out.push(best);
    left.delete(best);
    at = best;
  }
  return out;
}

/** Fewer violations first; then, with road data, less driving time (the fastest route), else less distance. */
function better(a: RouteEval, b: RouteEval | null, metric: Metric): boolean {
  if (!b) return true;
  if (a.violations.length !== b.violations.length) return a.violations.length < b.violations.length;
  if (metric.source !== 'mock' && Math.abs(a.durationMin - b.durationMin) > 1e-6) return a.durationMin < b.durationMin;
  return a.distanceKm < b.distanceKm - 1e-9;
}

function bestOrder(ids: string[], stations: Map<string, PlanStationInput>, cfg: PlanConfig, metric: Metric): RouteEval {
  const orders = ids.length <= 7 ? permutations(ids) : [nearestNeighbour(ids, cfg, metric)];
  let best: RouteEval | null = null;
  for (const o of orders) {
    const e = evaluate(o, stations, cfg, metric);
    if (better(e, best, metric)) best = e;
  }
  return best!;
}

const RANK: Record<StopClass, number> = { priority: 0, required: 1, optional: 2, skipped: 3 };

export function planRoute(input: PlanStationInput[], cfg: PlanConfig, metric: Metric = MOCK_METRIC): PlanResult {
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
    return { metric: metric.source, candidates, selected: [], planned: null, baseline: null, feasible: issues.length === 0, issues: issues.length ? issues : ['no_stops'] };
  }

  let planned = mandatory.length ? bestOrder(mandatory, stations, cfg, metric) : null;
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
    const trial = bestOrder([...current, c.id], stations, cfg, metric);
    const baseKm = planned ? planned.distanceKm : metric.km(DEPOT, cfg.endAt);
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

  if (!planned) return { metric: metric.source, candidates, selected: [], planned: null, baseline: null, feasible: issues.length === 0, issues: issues.length ? issues : ['no_stops'] };

  // Baseline: same stops, fixed station-id order, same constraints.
  const baseline = evaluate([...planned.order].sort(), stations, cfg, metric);
  const feasible = issues.length === 0 && planned.violations.length === 0;
  return { metric: metric.source, candidates, selected: planned.order, planned, baseline, feasible, issues: [...issues, ...planned.violations] };
}
