import { describe, it, expect } from 'vitest';
import { createSeedState } from './seed';
import { reducer, type Action } from './reducer';
import { attentionItems, batchGaps, batchStages, stationOps, userStationAvailability, userStats } from './ops';
import { fillPct } from './selectors';
import { defaultDispatchConfig, planFor, toAssignedRoute } from './dispatch';
import type { AppState } from './types';

const NOW = new Date('2026-10-10T10:00:00').getTime();

function run(state: AppState, ...actions: Action[]): AppState {
  return actions.reduce(reducer, state);
}
const st = (s: AppState, id: string) => s.stations.find((x) => x.id === id)!;

describe('operator attention', () => {
  it('ranks stopped before disconnected before warnings, one row per station', () => {
    const s = createSeedState(NOW);
    const items = attentionItems(s, NOW);
    expect(items.map((i) => i.stationId)).toEqual(['RE-003', 'RE-002']);
    expect(items[0]).toMatchObject({ kind: 'full', severity: 'stop' });
    expect(items[1]).toMatchObject({ kind: 'offline', severity: 'stale', also: ['warning'] });
    // Historical demand does not fill RE-001 within the 12-hour horizon.
    expect(items.some(i => i.stationId === 'RE-001')).toBe(false);
  });

  it('a disconnected station shows its last synced reading as stale, not a live value', () => {
    const s = createSeedState(NOW);
    const o = stationOps(s, st(s, 'RE-002'), NOW);
    expect(o.stale).toBe(true);
    expect(o.minutesSinceReading).toBeCloseTo(26, 0);
    // Station-side fill includes records still waiting to sync; the hub does not know them yet.
    expect(fillPct(s, st(s, 'RE-002'), 'station')).toBeGreaterThan(o.hubFillPct);
  });

  it('readings older than 15 minutes are stale even when the link reports online', () => {
    const s = createSeedState(NOW);
    expect(stationOps(s, st(s, 'RE-001'), NOW + 20 * 60_000).stale).toBe(true);
  });

  it('the app never claims availability it cannot know', () => {
    const s = createSeedState(NOW);
    expect(userStationAvailability(s, st(s, 'RE-002'))).toBe('unknown');
    expect(userStationAvailability(s, st(s, 'RE-003'))).toBe('stopped');
    expect(userStationAvailability(s, st(s, 'RE-001'))).toBe('open');
  });
});

describe('work orders and routes', () => {
  it('assigning a route schedules collection work and the driver confirmation closes it', () => {
    let s = createSeedState(NOW);
    s = run(s, { type: 'CREATE_TASK', task: { stationId: 'RE-003', kind: 'collection', reason: 'full', status: 'open', createdAt: NOW } });
    const cfg = defaultDispatchConfig(s);
    const plan = planFor(s, cfg);
    expect(plan.selected).toContain('RE-003');
    expect(plan.selected).toContain('RE-002');
    const route = toAssignedRoute(s, plan, cfg, NOW)!;
    expect(route.id).toBe('TU-0001');
    expect(route.stops.find((x) => x.stationId === 'RE-003')!.cls).toBe('priority');

    s = run(s, { type: 'ASSIGN_ROUTE', route, ts: NOW });
    const t3 = s.tasks.find((t) => t.stationId === 'RE-003' && t.kind === 'collection')!;
    expect(t3).toMatchObject({ status: 'scheduled', routeId: 'TU-0001' });
    expect(s.tasks.filter((t) => t.routeId === 'TU-0001')).toHaveLength(route.stops.length);

    s = run(
      s,
      { type: 'START_ROUTE', routeId: route.id },
      { type: 'CONFIRM_COLLECTION', stationId: 'RE-003', driver: route.driver, ts: NOW + 1, collectionId: 'TG-T1', newBinId: 'BIN-T1', routeId: route.id },
    );
    expect(s.tasks.find((t) => t.id === t3.id)!.status).toBe('done');
    expect(s.routes[0].stops.find((x) => x.stationId === 'RE-003')).toMatchObject({ status: 'done', collectionId: 'TG-T1' });
    expect(fillPct(s, st(s, 'RE-003'), 'hub')).toBe(0);
    expect(attentionItems(s, NOW).some((i) => i.stationId === 'RE-003')).toBe(false);
  });

  it('a skipped stop goes back to the operator when the route ends', () => {
    let s = createSeedState(NOW);
    const cfg = defaultDispatchConfig(s);
    const route = toAssignedRoute(s, planFor(s, cfg), cfg, NOW)!;
    s = run(s, { type: 'ASSIGN_ROUTE', route, ts: NOW }, { type: 'START_ROUTE', routeId: route.id });
    for (const sp of route.stops)
      s =
        sp.stationId === 'RE-002'
          ? run(s, { type: 'SKIP_STOP', routeId: route.id, stationId: 'RE-002', reason: 'Không vào được trạm' })
          : run(s, { type: 'CONFIRM_COLLECTION', stationId: sp.stationId, driver: route.driver, ts: NOW + 5, collectionId: `TG-${sp.stationId}`, newBinId: `B-${sp.stationId}`, routeId: route.id });
    s = run(s, { type: 'FINISH_ROUTE', routeId: route.id, ts: NOW + 10 });
    expect(s.routes[0].status).toBe('done');
    const t2 = s.tasks.find((t) => t.stationId === 'RE-002' && t.kind === 'collection')!;
    expect(t2).toMatchObject({ status: 'open', routeId: undefined });
  });

  it('a connectivity work order cannot be closed while the station is still offline', () => {
    let s = createSeedState(NOW);
    s = run(s, { type: 'CREATE_TASK', task: { id: 'VC-0100', stationId: 'RE-002', kind: 'maintenance', reason: 'offline', status: 'scheduled', createdAt: NOW } });
    s = run(s, { type: 'RESOLVE_TASK', taskId: 'VC-0100', ts: NOW + 1, resolution: 'x' });
    expect(s.tasks.find((t) => t.id === 'VC-0100')!.status).toBe('scheduled');
    s = run(s, { type: 'SET_CONNECTION', stationId: 'RE-002', connection: 'online', ts: NOW + 2 }, { type: 'RESOLVE_TASK', taskId: 'VC-0100', ts: NOW + 3, resolution: 'Đã khởi động lại modem 4G' });
    expect(s.tasks.find((t) => t.id === 'VC-0100')!.status).toBe('done');
  });

  it('confirming a jam repair re-enables the station', () => {
    let s = createSeedState(NOW);
    s = run(
      s,
      { type: 'SET_FAULT', stationId: 'RE-001', fault: 'jam', ts: NOW },
      { type: 'CREATE_TASK', task: { id: 'VC-0200', stationId: 'RE-001', kind: 'maintenance', reason: 'jam', status: 'scheduled', createdAt: NOW } },
    );
    expect(attentionItems(s, NOW)[0]).toMatchObject({ stationId: 'RE-001', kind: 'jam' });
    s = run(s, { type: 'RESOLVE_TASK', taskId: 'VC-0200', ts: NOW + 1, resolution: 'Đã gỡ kẹt và chạy thử 3 chai' });
    expect(st(s, 'RE-001').fault).toBeNull();
  });
});

describe('traceability', () => {
  it('shows five stages and flags missing recycler evidence', () => {
    const s = createSeedState(NOW);
    const b1 = s.batches.find((b) => b.id === 'LO-0001')!;
    expect(batchStages(s, b1).map((x) => x.status)).toEqual(['done', 'done', 'done', 'done', 'missing']);
    expect(batchGaps(s, b1, NOW).map((g) => g.kind)).toContain('no_recycler_doc');
  });

  it('flags a weighed batch that differs from the estimate by more than 5 %', () => {
    const s = createSeedState(NOW);
    const b2 = s.batches.find((b) => b.id === 'LO-0002')!;
    const gap = batchGaps(s, b2, NOW).find((g) => g.kind === 'discrepancy');
    expect(gap?.value).toBeLessThan(-5);
  });

  it('downstream outcome needs a recycler document first', () => {
    let s = createSeedState(NOW);
    s = run(s, { type: 'BATCH_RECORD_DOWNSTREAM', batchId: 'LO-0001', confirmedKg: 10, note: 'x', ts: NOW });
    expect(s.batches.find((b) => b.id === 'LO-0001')!.downstream).toBeUndefined();
    s = run(
      s,
      { type: 'BATCH_ATTACH_EVIDENCE', batchId: 'LO-0001', evidence: { id: 'EV-T', kind: 'recycler_document', label: 'x', fileName: 'x.pdf', ts: NOW, origin: 'attached' } },
      { type: 'BATCH_RECORD_DOWNSTREAM', batchId: 'LO-0001', confirmedKg: 10, note: 'x', ts: NOW },
    );
    const b1 = s.batches.find((b) => b.id === 'LO-0001')!;
    expect(b1.downstream?.confirmedKg).toBe(10);
    expect(batchStages(s, b1)[4].status).toBe('done');
  });
});

describe('mobile user', () => {
  it('keeps credited and pending points apart', () => {
    const s = createSeedState(NOW);
    const u = userStats(s, 'SV-DEMO-01');
    expect(u.pendingPoints).toBe(2 * s.settings.pointsPerBottle);
    expect(u.creditedPoints % s.settings.pointsPerBottle).toBe(0);
  });
});
