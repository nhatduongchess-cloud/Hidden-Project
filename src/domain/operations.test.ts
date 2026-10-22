import { describe, it, expect } from 'vitest';
import { createSeedState } from './seed';
import { demandModel, forecastStation } from './forecast';
import { operatingKpis, fullStationHours } from './analytics';
import { defaultDispatchConfig, toAssignedRoute } from './dispatch';
import { planRoute, evaluate, type Metric, type PlanStationInput } from './routing';
import { reducer } from './reducer';

const NOW = Date.parse('2026-10-21T08:00:00+07:00');
const HOUR = 3_600_000;

describe('historical demand', () => {
  it('uses completed days and excludes pending, future and rejected mass', () => {
    const s = createSeedState(NOW),
      st = s.stations[0];
    const model = demandModel(s, st, NOW);
    expect(model.source).toBe('history');
    const t = s.transactions.find((t) => t.stationId === st.id && t.status === 'accepted')!;
    s.transactions.push(
      { ...t, id: 'pending', sync: 'pending', acceptedMassG: 1e8 },
      { ...t, id: 'future', ts: NOW + HOUR, acceptedMassG: 1e8 },
      { ...t, id: 'rejected', status: 'rejected', acceptedMassG: 1e8 },
    );
    expect(demandModel(s, st, NOW)).toEqual(model);
  });
  it('uses fallback only with sparse history and respects closed hours', () => {
    const s = createSeedState(NOW),
      st = s.stations[0];
    s.transactions = [];
    st.accessWindow = { start: '09:00', end: '17:00' };
    const f = forecastStation(s, st, NOW, 2);
    expect(f.model.source).toBe('assumption');
    expect(f.points.find((p) => p.ts === NOW + HOUR)!.pct).toBe(0);
    expect(f.points.at(-1)!.pct).toBeGreaterThan(0);
  });
  it('season scenario changes forecasts, but never exceeds the stop threshold', () => {
    const s = createSeedState(NOW),
      st = s.stations[0];
    const low = forecastStation(s, st, NOW, 48, 0.6);
    const high = forecastStation(s, st, NOW, 48, 1.4);
    expect(high.points.at(-1)!.pct).toBeGreaterThan(low.points.at(-1)!.pct);
    expect(high.points.every((p) => p.pct <= s.settings.stopPct)).toBe(true);
    expect(high.reaches80At).not.toBeNull();
  });
  it('faults freeze the forecast and offline readings are labelled stale', () => {
    const s = createSeedState(NOW),
      st = s.stations[0];
    st.fault = 'jam';
    st.connection = 'offline';
    const f = forecastStation(s, st, NOW, 72);
    expect(f.stale).toBe(true);
    expect(f.points.every((p) => p.pct === f.currentPct)).toBe(true);
    expect(f.reaches80At).toBeNull();
  });
});

const input: PlanStationInput[] = [{ id: 'RE-003', currentPct: 96, forecastPct: 96, massKg: 7, window: { start: '07:00', end: '17:00' } }];
const metric: Metric = { source: 'road', km: () => 5, minutes: () => 30 };
describe('dispatch constraints', () => {
  it('waits for a ban to end, including when only the final leg overlaps', () => {
    const cfg = { ...defaultDispatchConfig(createSeedState(NOW)), serviceMin: 0, drivingBans: [{ start: '08:45', end: '10:00' }] };
    const e = evaluate(['RE-003'], new Map(input.map((s) => [s.id, s])), cfg, metric);
    expect(e.banWaitMin).toBe(90);
    expect(e.finishMin).toBe(630);
    expect(e.violations).toEqual([]);
  });
  it('service must finish before closing, not merely arrive before closing', () => {
    const s = createSeedState(NOW),
      cfg = { ...defaultDispatchConfig(s), serviceMin: 10 };
    const r = planRoute([{ ...input[0], window: { start: '07:00', end: '08:35' } }], cfg, metric);
    expect(r.feasible).toBe(false);
    expect(r.issues).toContain('window:RE-003');
    expect(toAssignedRoute(s, r, cfg, NOW)).toBeNull();
  });
  it('a missing mandatory stop cannot be dispatched as a partial successful route', () => {
    const s = createSeedState(NOW),
      cfg = { ...defaultDispatchConfig(s), payloadKg: 1 };
    const r = planRoute(input, cfg, metric);
    expect(r.issues).toContain('payload_required:RE-003');
    expect(toAssignedRoute(s, r, cfg, NOW)).toBeNull();
  });
  it('rejects invalid and over-one-tonne configurations', () => {
    const cfg = defaultDispatchConfig(createSeedState(NOW));
    for (const patch of [
      { payloadKg: 1001 },
      { speedKmh: 0 },
      { cargoVolumeM3: NaN },
      { shiftEnd: '07:00' },
      { drivingBans: [{ start: '08:00', end: '08:00' }] },
    ]) {
      expect(planRoute(input, { ...cfg, ...patch }, metric).issues).toContain('invalid_config');
    }
  });
  it('labels an unreachable leg infeasible', () => {
    const r = planRoute(input, defaultDispatchConfig(createSeedState(NOW)), {
      source: 'road',
      km: () => Infinity,
      minutes: () => Infinity,
    });
    expect(r.feasible).toBe(false);
    expect(r.issues).toContain('unreachable');
  });
});

describe('operating KPIs', () => {
  it('uses null for cost and efficiency without completed route evidence', () => {
    const k = operatingKpis(createSeedState(NOW), NOW - 30 * 24 * HOUR, NOW, 6000, 50000);
    expect(k.costPerKg).toBeNull();
    expect(k.kgPerKm).toBeNull();
    expect(k.pickupPct).toBeGreaterThan(0);
  });
  it('clips full intervals and closes them at bin swap, ignoring duplicate events', () => {
    const s = createSeedState(NOW);
    s.log = [
      { ts: NOW - 3 * HOUR, stationId: 'RE-003', text: 'stop_reached', level: 'error' },
      { ts: NOW - HOUR, stationId: 'RE-003', text: 'stop_reached', level: 'error' },
    ];
    expect(fullStationHours(s, NOW - 2 * HOUR, NOW)).toEqual({ hours: 2, intervals: 1 });
    const next = reducer(s, {
      type: 'CONFIRM_COLLECTION',
      stationId: 'RE-003',
      driver: 'Test',
      ts: NOW - HOUR,
      collectionId: 'NEW',
      newBinId: 'NEW-BIN',
    });
    expect(fullStationHours(next, NOW - 2 * HOUR, NOW)).toEqual({ hours: 1, intervals: 1 });
  });
  it('joins completed stops to their collection mass and excludes skipped stops', () => {
    let s = createSeedState(NOW);
    const cfg = defaultDispatchConfig(s),
      plan = planRoute(input, cfg, metric);
    const route = toAssignedRoute(s, plan, cfg, NOW)!;
    s = reducer(s, { type: 'ASSIGN_ROUTE', route, ts: NOW });
    s = reducer(s, {
      type: 'CONFIRM_COLLECTION',
      stationId: 'RE-003',
      driver: 'Test',
      ts: NOW,
      collectionId: 'NEW',
      newBinId: 'NEW-BIN',
      routeId: route.id,
    });
    s = reducer(s, { type: 'FINISH_ROUTE', routeId: route.id, ts: NOW + HOUR });
    const k = operatingKpis(s, NOW - HOUR, NOW + HOUR, 6000, 50000);
    expect(k.routes).toBe(1);
    expect(k.matchedKg).toBeGreaterThan(0);
    expect(k.costPerKg).toBeCloseTo((route.distanceKm * 6000 + 50000) / k.matchedKg);
  });
});
