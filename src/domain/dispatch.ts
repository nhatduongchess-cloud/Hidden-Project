import type { AppState, AssignedRoute, StopClassAssigned } from './types';
import { activeBinMassKg, fillPct } from './selectors';
import { forecastStation } from './forecast';
import { planRoute, PARTNER, MOCK_METRIC, type Metric, type PlanConfig, type PlanResult, type PlanStationInput } from './routing';
import { nextRouteId } from './reducer';

/** Planner settings an operator edits in RE Hub, plus the forecast horizon. */
export type DispatchConfig = PlanConfig & { nextHours: number; demandMultiplier?: number };

export const DEMO_DRIVER = 'Tài xế demo 01';

export function defaultDispatchConfig(state: AppState): DispatchConfig {
  return {
    departure: '08:00',
    objective: 'distance',
    shiftEnd: '17:00',
    payloadKg: 500,
    cargoVolumeM3: 2,
    binVolumeM3: state.settings.binVolumeM3,
    serviceMin: 8,
    speedKmh: 20,
    thresholdPct: state.settings.warnPct,
    stopPct: state.settings.stopPct,
    includeNearby: true,
    nearbyMinPct: 50,
    maxDetourKm: 2,
    endAt: PARTNER,
    nextHours: 12,
    demandMultiplier: state.settings.demandMultiplier ?? 1,
  };
}

/** Planner input uses what RE Hub has received. A disconnected station is planned from its last reading. */
export function planInputs(state: AppState, nextHours: number, multiplier = 1): PlanStationInput[] {
  return state.stations.map((s) => ({
    id: s.id,
    currentPct: fillPct(state, s, 'hub'),
    forecastPct: forecastStation(state, s, Date.now(), nextHours, multiplier).points.at(-1)!.pct,
    massKg: activeBinMassKg(state, s, 'hub'),
    window: s.accessWindow,
  }));
}

export function planFor(state: AppState, cfg: DispatchConfig, metric: Metric = MOCK_METRIC): PlanResult {
  return planRoute(planInputs(state, cfg.nextHours, cfg.demandMultiplier), cfg, metric);
}

/** Turn a planner result into the route handed to the driver's phone. */
export function toAssignedRoute(state: AppState, plan: PlanResult, cfg: DispatchConfig, now: number, driver = DEMO_DRIVER): AssignedRoute | null {
  if (!plan.feasible || !plan.planned || plan.planned.stops.length === 0) return null;
  const cls = new Map(plan.candidates.map((c) => [c.id, c]));
  return {
    id: nextRouteId(state),
    createdAt: now,
    departure: cfg.departure,
    endAt: cfg.endAt,
    driver,
    payloadKg: cfg.payloadKg,
    cargoVolumeM3: cfg.cargoVolumeM3,
    stops: plan.planned.stops.map((s) => {
      const c = cls.get(s.id);
      return {
        stationId: s.id,
        cls: (c && c.cls !== 'skipped' ? c.cls : 'optional') as StopClassAssigned,
        status: 'pending',
        estKg: s.massKg,
        fillPctAtPlan: c?.st.currentPct ?? 0,
        etaMin: s.arriveMin,
      };
    }),
    distanceKm: plan.planned.distanceKm,
    durationMin: plan.planned.durationMin,
    metric: plan.metric,
    status: 'assigned',
  };
}
