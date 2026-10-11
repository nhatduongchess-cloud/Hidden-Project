import { describe, it, expect, beforeEach } from 'vitest';
import { createSeedState } from './seed';
import { reducer, type Action } from './reducer';
import { runSessionSync, type SessionInput } from './deposit';
import { fillPct, totals, activeBinMassKg, userBalances, filterTxs, EMPTY_FILTERS, canAcceptNext } from './selectors';
import { createStore, type StorageLike } from './store';
import { planRoute, type PlanConfig, type PlanStationInput } from './routing';
import { calculate, BASE_STATION } from './calculator';
import { transactionsCsv, filteredTxRows, TX_CSV_HEADERS } from './report';
import { parseCsv } from './csv';
import type { AppState, ItemInput } from './types';

const NOW = new Date('2026-10-10T10:00:00').getTime();
let clock = NOW;
const now = () => (clock += 1000);

function harness(init?: AppState) {
  let state = init ?? createSeedState(NOW);
  const getState = () => state;
  const dispatch = (a: Action) => (state = reducer(state, a));
  return { getState, dispatch, set: (s: AppState) => (state = s) };
}

const PET: ItemInput = { material: 'PET_CLEAR', liquid: 'empty', barcode: 'recognized', brand: 'BRAND_A', confidencePct: 92 };
const session = (over: Partial<SessionInput> = {}): SessionInput => ({ stationId: 'RE-001', userId: 'SV-DEMO-01', item: PET, quantity: 1, ...over });

function snapshot(s: AppState, stationId = 'RE-001') {
  const st = s.stations.find((x) => x.id === stationId)!;
  const t = totals(s.transactions);
  return {
    accepted: t.acceptedBottles,
    kg: t.acceptedKg,
    points: t.points + t.pendingPoints,
    fill: fillPct(s, st),
    binKg: activeBinMassKg(s, st),
    txCount: s.transactions.length,
    userPts: userBalances(s).get('SV-DEMO-01')!,
  };
}

beforeEach(() => {
  clock = NOW;
});

describe('1. accepted bottle updates mass, fill, transactions and rewards exactly once', () => {
  it('credits one bottle once', () => {
    const h = harness();
    const before = snapshot(h.getState());
    const steps = runSessionSync(h.getState, h.dispatch, session(), now);
    const after = snapshot(h.getState());
    expect(steps.map((s) => s.phase)).toEqual([
      'USER_IDENTIFIED', 'BOTTLE_INSERTED', 'DOOR_CLOSED', 'INSPECTING', 'ACCEPTED', 'FLATTENING', 'DROP_CONFIRMED', 'POINTS_CREDITED', 'DONE',
    ]);
    expect(after.accepted - before.accepted).toBe(1);
    expect(after.kg - before.kg).toBeCloseTo(0.022, 6);
    expect(after.points - before.points).toBe(10);
    expect(after.txCount - before.txCount).toBe(1);
    expect(after.fill - before.fill).toBeCloseTo((0.022 / 7.2) * 100, 6);
    expect(after.userPts.credited - before.userPts.credited).toBe(10);
  });
  it('replaying the same commit does not credit twice', () => {
    const h = harness();
    const steps = runSessionSync(h.getState, h.dispatch, session(), now);
    const commit = steps.find((s) => s.phase === 'POINTS_CREDITED')!.actions![0];
    const mid = snapshot(h.getState());
    h.dispatch(commit);
    h.dispatch(commit);
    expect(snapshot(h.getState())).toEqual(mid);
  });
  it('points are credited only at the POINTS_CREDITED step, after DROP_CONFIRMED', () => {
    const h = harness();
    const steps = runSessionSync(h.getState, h.dispatch, session(), now);
    const idxCommit = steps.findIndex((s) => s.actions?.some((a) => a.type === 'COMMIT_ACCEPTED'));
    const idxDrop = steps.findIndex((s) => s.phase === 'DROP_CONFIRMED');
    expect(idxCommit).toBeGreaterThan(idxDrop);
    expect(steps.filter((s) => s.actions?.some((a) => a.type === 'COMMIT_ACCEPTED')).length).toBe(1);
  });
  it('multiple bottles are processed sequentially, one commit each', () => {
    const h = harness();
    const before = snapshot(h.getState());
    const steps = runSessionSync(h.getState, h.dispatch, session({ quantity: 5 }), now);
    expect(steps.filter((s) => s.phase === 'POINTS_CREDITED').map((s) => s.bottle)).toEqual([1, 2, 3, 4, 5]);
    expect(snapshot(h.getState()).accepted - before.accepted).toBe(5);
  });
});

describe('2. rejected bottles change no accepted totals', () => {
  const cases: [string, Partial<ItemInput>][] = [
    ['HDPE', { material: 'HDPE' }],
    ['glass', { material: 'GLASS' }],
    ['metal can', { material: 'METAL_CAN' }],
    ['unknown object', { material: 'UNKNOWN_OBJECT', confidencePct: 40, barcode: 'unknown' }],
    ['excess liquid', { liquid: 'excess' }],
    ['uncertain identification', { barcode: 'unknown', confidencePct: 62 }],
  ];
  for (const [name, item] of cases) {
    it(name, () => {
      const h = harness();
      const b = snapshot(h.getState());
      const steps = runSessionSync(h.getState, h.dispatch, session({ item: { ...PET, ...item }, quantity: 3 }), now);
      const a = snapshot(h.getState());
      expect(steps.filter((s) => s.phase === 'RETURNED').length).toBe(3);
      expect(a.accepted).toBe(b.accepted);
      expect(a.kg).toBeCloseTo(b.kg, 9);
      expect(a.points).toBe(b.points);
      expect(a.fill).toBeCloseTo(b.fill, 9);
      expect(a.txCount - b.txCount).toBe(3); // rejection records exist, with zero mass and points
      const rej = h.getState().transactions.slice(-3);
      rej.forEach((t) => {
        expect(t.status).toBe('rejected');
        expect(t.acceptedMassG).toBe(0);
        expect(t.points).toBe(0);
      });
    });
  }
  it('a forged rejected record with mass is sanitised by the reducer', () => {
    const h = harness();
    const b = snapshot(h.getState());
    const st = h.getState().stations[0];
    h.dispatch({ type: 'RECORD_ITEM', tx: { id: 'X1', stationId: st.id, binId: st.activeBinId, userId: 'SV-DEMO-01', ts: NOW, material: 'HDPE', brand: 'UNKNOWN', barcodeRecognized: false, confidencePct: 90, measuredG: 30, acceptedMassG: 30, status: 'rejected', points: 10, sync: 'synced' } });
    expect(snapshot(h.getState()).kg).toBeCloseTo(b.kg, 9);
    expect(snapshot(h.getState()).points).toBe(b.points);
  });
});

describe('3. a station crossing 80% receives a collection warning', () => {
  it('RE-001 crosses 80% and logs a warning', () => {
    const h = harness();
    const st = () => h.getState().stations.find((s) => s.id === 'RE-001')!;
    expect(fillPct(h.getState(), st())).toBeLessThan(80);
    const need = Math.ceil(((80 - fillPct(h.getState(), st())) / 100) * 7200 / 22);
    runSessionSync(h.getState, h.dispatch, session({ quantity: need }), now);
    expect(fillPct(h.getState(), st())).toBeGreaterThanOrEqual(80);
    expect(h.getState().log.some((l) => l.stationId === 'RE-001' && l.text === 'warn_crossed')).toBe(true);
  });
});

describe('4. a station at 95% blocks further deposits', () => {
  it('RE-003 (seeded ≥95%) blocks before inspection', () => {
    const h = harness();
    const b = snapshot(h.getState(), 'RE-003');
    const steps = runSessionSync(h.getState, h.dispatch, session({ stationId: 'RE-003', quantity: 2 }), now);
    expect(steps.at(-1)!.phase).toBe('BLOCKED');
    expect(steps.at(-1)!.blockedWhy).toBe('full');
    expect(steps.some((s) => s.phase === 'INSPECTING')).toBe(false);
    expect(snapshot(h.getState(), 'RE-003')).toEqual(b);
  });
  it('a long session stops itself when 95% is reached', () => {
    const h = harness();
    const steps = runSessionSync(h.getState, h.dispatch, session({ stationId: 'RE-002', quantity: 200 }), now);
    const st = h.getState().stations.find((s) => s.id === 'RE-002')!;
    expect(steps.at(-1)!.phase).toBe('BLOCKED');
    const f = fillPct(h.getState(), st);
    expect(f).toBeGreaterThanOrEqual(95);
    expect(f).toBeLessThan(95 + (22 / 7200) * 100 + 1e-9);
    expect(canAcceptNext(h.getState(), st).ok).toBe(false);
  });
});

describe('5. jam and emergency stop prevent reward credit', () => {
  for (const kind of ['jam', 'estop'] as const) {
    it(kind, () => {
      const h = harness();
      const b = snapshot(h.getState());
      const steps = runSessionSync(h.getState, h.dispatch, session({ quantity: 3, inject: { kind, atBottle: 2 } }), now);
      const a = snapshot(h.getState());
      expect(steps.at(-1)!.phase).toBe('FAULT');
      expect(a.accepted - b.accepted).toBe(1); // only bottle 1 completed
      expect(a.points - b.points).toBe(10);
      const st = h.getState().stations.find((s) => s.id === 'RE-001')!;
      expect(st.fault).toBe(kind);
      const aborted = h.getState().transactions.at(-1)!;
      expect(aborted.status).toBe('aborted');
      expect(aborted.points).toBe(0);
      // Station refuses new sessions while faulted.
      const again = runSessionSync(h.getState, h.dispatch, session(), now);
      expect(again.at(-1)!.blockedWhy).toBe('fault');
      // A late commit for the jammed bottle is refused.
      const fakeCommit = steps.find((s) => s.phase === 'FAULT')!;
      h.dispatch({ type: 'COMMIT_ACCEPTED', tx: { ...aborted, id: fakeCommit.txId!, status: 'accepted', acceptedMassG: 22, points: 10 } });
      expect(snapshot(h.getState()).points - b.points).toBe(10);
    });
  }
  it('live e-stop between drop and credit: the commit is refused', () => {
    const h = harness();
    const b = snapshot(h.getState());
    const steps = runSessionSync(h.getState, () => {}, session(), now); // collect steps without applying
    const commit = steps.find((s) => s.phase === 'POINTS_CREDITED')!.actions![0];
    h.dispatch({ type: 'SET_FAULT', stationId: 'RE-001', fault: 'estop', ts: NOW });
    h.dispatch(commit);
    expect(snapshot(h.getState()).points).toBe(b.points);
  });
});

describe('6. offline synchronisation does not duplicate records', () => {
  it('pending records sync once even if uploaded twice', () => {
    const h = harness();
    const b = snapshot(h.getState());
    const pend0 = totals(h.getState().transactions).pendingPoints; // seed: RE-002 is offline with its own pending records
    const onlyR1 = (t: { sync: string; stationId: string }) => t.sync === 'pending' && t.stationId === 'RE-001';
    h.dispatch({ type: 'SET_CONNECTION', stationId: 'RE-001', connection: 'offline', ts: NOW });
    runSessionSync(h.getState, h.dispatch, session({ quantity: 4 }), now);
    const pending = h.getState().transactions.filter(onlyR1);
    expect(pending.length).toBe(4);
    const t = totals(h.getState().transactions);
    expect(t.pendingPoints - pend0).toBe(40);
    // Hub view excludes pending records from fill.
    const st = h.getState().stations.find((s) => s.id === 'RE-001')!;
    expect(fillPct(h.getState(), st, 'station')).toBeGreaterThan(fillPct(h.getState(), st, 'hub'));
    // Upload while still offline is refused.
    h.dispatch({ type: 'SYNC_UPLOAD', stationId: 'RE-001', records: pending, ts: NOW });
    expect(h.getState().transactions.filter(onlyR1).length).toBe(4);
    h.dispatch({ type: 'SET_CONNECTION', stationId: 'RE-001', connection: 'online', ts: NOW });
    h.dispatch({ type: 'SYNC_UPLOAD', stationId: 'RE-001', records: pending, ts: NOW });
    h.dispatch({ type: 'SYNC_UPLOAD', stationId: 'RE-001', records: pending, ts: NOW }); // retry duplicate
    const a = snapshot(h.getState());
    expect(a.txCount - b.txCount).toBe(4);
    expect(a.points - b.points).toBe(40);
    expect(totals(h.getState().transactions).pendingPoints).toBe(pend0);
    expect(h.getState().transactions.filter(onlyR1).length).toBe(0);
    expect(h.getState().duplicateSyncIgnored).toBe(4);
    expect(new Set(h.getState().transactions.map((t) => t.id)).size).toBe(h.getState().transactions.length);
  });
});

describe('7. confirmed collection resets the bin and preserves history', () => {
  it('RE-003 collection', () => {
    const h = harness();
    const s0 = h.getState();
    const st0 = s0.stations.find((s) => s.id === 'RE-003')!;
    const lifetimeBefore = totals(s0.transactions.filter((t) => t.stationId === 'RE-003'));
    const binKg = activeBinMassKg(s0, st0);
    h.dispatch({ type: 'CONFIRM_COLLECTION', stationId: 'RE-003', driver: 'Tài xế demo', ts: NOW, collectionId: 'TG-TEST', newBinId: 'RE-003-BIN-NEW' });
    h.dispatch({ type: 'CONFIRM_COLLECTION', stationId: 'RE-003', driver: 'Tài xế demo', ts: NOW, collectionId: 'TG-TEST', newBinId: 'RE-003-BIN-NEW2' });
    const s1 = h.getState();
    const st1 = s1.stations.find((s) => s.id === 'RE-003')!;
    expect(st1.activeBinId).toBe('RE-003-BIN-NEW');
    expect(fillPct(s1, st1)).toBe(0);
    expect(totals(s1.transactions.filter((t) => t.stationId === 'RE-003'))).toEqual(lifetimeBefore);
    const rec = s1.collections.find((c) => c.id === 'TG-TEST')!;
    expect(s1.collections.filter((c) => c.id === 'TG-TEST').length).toBe(1);
    expect(rec.estimatedKg).toBeCloseTo(binKg, 9);
    const batch = s1.batches.find((b) => b.id === rec.batchId)!;
    expect(batch.collectionIds).toContain('TG-TEST');
    expect(batch.status).toBe('open');
    expect(canAcceptNext(s1, st1).ok).toBe(true);
    // Collected bottles are never automatically counted as recycled.
    expect(batch.downstream).toBeUndefined();
  });
  it('downstream outcome requires handover and a recycler document', () => {
    const h = harness();
    const open = h.getState().batches.find((b) => b.status === 'open')!;
    h.dispatch({ type: 'BATCH_RECORD_DOWNSTREAM', batchId: open.id, confirmedKg: 5, note: '', ts: NOW });
    expect(h.getState().batches.find((b) => b.id === open.id)!.downstream).toBeUndefined();
    h.dispatch({ type: 'BATCH_RECEIVE', batchId: open.id, measuredKg: 30, ticketNo: 'T1', ts: NOW });
    h.dispatch({ type: 'BATCH_HANDOVER', batchId: open.id, partner: 'P', ts: NOW });
    h.dispatch({ type: 'BATCH_RECORD_DOWNSTREAM', batchId: open.id, confirmedKg: 5, note: '', ts: NOW });
    expect(h.getState().batches.find((b) => b.id === open.id)!.downstream).toBeUndefined();
    h.dispatch({ type: 'BATCH_ATTACH_EVIDENCE', batchId: open.id, evidence: { id: 'E1', kind: 'recycler_document', label: 'x', fileName: 'x.pdf', ts: NOW, origin: 'attached' } });
    h.dispatch({ type: 'BATCH_RECORD_DOWNSTREAM', batchId: open.id, confirmedKg: 5, note: '', ts: NOW });
    expect(h.getState().batches.find((b) => b.id === open.id)!.downstream?.confirmedKg).toBe(5);
  });
});

describe('8. routing exposes capacity and scheduling violations', () => {
  const st: PlanStationInput[] = [
    { id: 'RE-001', currentPct: 56, forecastPct: 70, massKg: 4.0, window: { start: '07:00', end: '21:00' } },
    { id: 'RE-002', currentPct: 83, forecastPct: 95, massKg: 6.0, window: { start: '06:00', end: '22:00' } },
    { id: 'RE-003', currentPct: 96, forecastPct: 96, massKg: 6.9, window: { start: '07:30', end: '17:00' } },
  ];
  const cfg: PlanConfig = {
    departure: '08:00', shiftEnd: '17:00', payloadKg: 500, cargoVolumeM3: 2, binVolumeM3: 0.24, serviceMin: 8, speedKmh: 20,
    thresholdPct: 80, stopPct: 95, includeNearby: true, nearbyMinPct: 50, maxDetourKm: 2, endAt: 'PARTNER',
  };
  it('feasible plan: priority + required + nearby, better than or equal to baseline', () => {
    const r = planRoute(st, cfg);
    expect(r.feasible).toBe(true);
    expect(new Set(r.selected)).toEqual(new Set(['RE-001', 'RE-002', 'RE-003']));
    expect(r.planned!.distanceKm).toBeLessThanOrEqual(r.baseline!.distanceKm);
    expect(r.baseline!.order).toEqual(['RE-001', 'RE-002', 'RE-003']);
  });
  it('payload too small for required stops is flagged', () => {
    const r = planRoute(st, { ...cfg, payloadKg: 8 });
    expect(r.feasible).toBe(false);
    expect(r.issues.some((i) => i.startsWith('payload_required'))).toBe(true);
    expect(r.planned!.collectedKg).toBeLessThanOrEqual(8);
  });
  it('cargo volume for one bin only is flagged', () => {
    const r = planRoute(st, { ...cfg, cargoVolumeM3: 0.3 });
    expect(r.feasible).toBe(false);
    expect(r.issues.some((i) => i.startsWith('volume_required'))).toBe(true);
    expect(r.selected).toEqual(['RE-003']);
  });
  it('closed access window is flagged, not silently violated', () => {
    const r = planRoute(st, { ...cfg, departure: '16:50', shiftEnd: '23:00' });
    expect(r.feasible).toBe(false);
    expect(r.issues).toContain('window:RE-003');
    expect(r.planned!.stops.find((s) => s.id === 'RE-003')!.late).toBe(true);
  });
  it('shift end is enforced', () => {
    const r = planRoute(st, { ...cfg, departure: '16:00', shiftEnd: '16:30' });
    expect(r.feasible).toBe(false);
    expect(r.issues).toContain('shift_end');
  });
  it('nearby station is skipped when it costs a window violation', () => {
    const r = planRoute(
      st.map((s) => (s.id === 'RE-001' ? { ...s, window: { start: '07:00', end: '08:10' } } : s)),
      { ...cfg, departure: '08:00' },
    );
    expect(r.selected).not.toContain('RE-001');
    expect(r.candidates.find((c) => c.id === 'RE-001')!.reason).toBe('nearby_no_time');
  });
  it('forecast to reach threshold makes a stop required', () => {
    const r = planRoute(st, { ...cfg, includeNearby: false });
    expect(r.candidates.find((c) => c.id === 'RE-001')!.cls).toBe('skipped');
    const r2 = planRoute(st.map((s) => (s.id === 'RE-001' ? { ...s, forecastPct: 81 } : s)), { ...cfg, includeNearby: false });
    expect(r2.candidates.find((c) => c.id === 'RE-001')!.cls).toBe('required');
  });
});

describe('9. filtered exports match the visible data', () => {
  it('CSV rows equal filtered table rows', () => {
    const s = createSeedState(NOW);
    const d = new Date(NOW - 2 * 86_400_000);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const f = { ...EMPTY_FILTERS, stationId: 'RE-002', material: 'PET_CLEAR' as const, brand: 'UNKNOWN' as const, from: iso };
    const visible = filteredTxRows(s, f);
    const parsed = parseCsv(transactionsCsv(s, f));
    expect(parsed[0]).toEqual(TX_CSV_HEADERS);
    expect(parsed.length - 1).toBe(visible.length);
    expect(parsed.slice(1).map((r) => r[0])).toEqual(visible.map((t) => t.id));
    expect(visible.length).toBeGreaterThan(0);
    parsed.slice(1).forEach((r) => {
      expect(r[2]).toBe('RE-002');
      expect(r[7]).toBe('PET_CLEAR');
      expect(r[8]).toBe('UNKNOWN');
    });
    const sumG = parsed.slice(1).reduce((a, r) => a + Number(r[12]), 0);
    expect(sumG / 1000).toBeCloseTo(totals(visible).acceptedKg, 9);
  });
  it('brand role only sees its own brand', () => {
    let s = createSeedState(NOW);
    s = reducer(s, { type: 'SET_ROLE', role: 'brand', brandView: 'BRAND_B' });
    const rows = filterTxs(s, { ...EMPTY_FILTERS, brand: 'all' });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((t) => t.brand === 'BRAND_B')).toBe(true);
  });
});

describe('10. calculator stays consistent when assumptions change', () => {
  it('base station matches hand calculation', () => {
    const o = calculate(BASE_STATION);
    expect(o.massKgYear).toBeCloseTo(300 * 0.022 * 365, 6);
    expect(o.revenue.total).toBeCloseTo(o.revenue.material + o.revenue.service + o.revenue.sponsorship, 6);
    expect(o.cost.total).toBeCloseTo(o.cost.operating + o.cost.collection + o.cost.rewards + o.cost.networkFixed, 6);
    expect(o.netYear).toBeCloseTo(o.revenue.total - o.cost.total, 6);
    expect(o.paybackYears!).toBeCloseTo(45_000_000 / o.netYear, 9);
  });
  it('linear in stations when there is no network fixed cost', () => {
    const a = calculate({ ...BASE_STATION, stations: 1 });
    const b = calculate({ ...BASE_STATION, stations: 7 });
    expect(b.netYear).toBeCloseTo(a.netYear * 7, 3);
    expect(b.paybackYears!).toBeCloseTo(a.paybackYears!, 9);
  });
  it('period scales annual values', () => {
    const o = calculate({ ...BASE_STATION, periodMonths: 3 });
    expect(o.period.net).toBeCloseTo(o.netYear / 4, 6);
    expect(o.period.massKg).toBeCloseTo(o.massKgYear / 4, 6);
  });
  it('non-positive cash flow gives no payback', () => {
    expect(calculate({ ...BASE_STATION, includeService: false, includeSponsorship: false, operatingVndStationYear: 20_000_000 }).paybackYears).toBeNull();
    expect(calculate({ ...BASE_STATION, materialPriceVndKg: 0, includeService: false, includeSponsorship: false }).paybackYears).toBeNull();
  });
  it('raising a cost never improves net', () => {
    const a = calculate(BASE_STATION);
    for (const k of ['operatingVndStationYear', 'collectionVndKg', 'rewardVndBottle', 'networkFixedVndYear'] as const) {
      expect(calculate({ ...BASE_STATION, [k]: BASE_STATION[k] + 1000 }).netYear).toBeLessThan(a.netYear);
    }
  });
});

describe('11. persistence and reset', () => {
  function memStorage(): StorageLike & { data: Map<string, string> } {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
  }
  it('reload preserves state; reset restores seed', async () => {
    const mem = memStorage();
    const seed = () => createSeedState(NOW);
    const s1 = createStore(mem, seed);
    const seedTotals = totals(s1.getState().transactions);
    runSessionSync(s1.getState, s1.dispatch, session({ quantity: 3 }), now);
    await new Promise((r) => setTimeout(r, 250));
    const s2 = createStore(mem, seed); // simulated refresh
    expect(totals(s2.getState().transactions).acceptedBottles).toBe(seedTotals.acceptedBottles + 3);
    s2.reset();
    expect(totals(s2.getState().transactions)).toEqual(seedTotals);
    const s3 = createStore(mem, seed);
    expect(totals(s3.getState().transactions)).toEqual(seedTotals);
  });
  it('corrupt storage falls back to seed', () => {
    const mem = memStorage();
    mem.setItem('re-demo-state-v3', '{not json');
    const s = createStore(mem, () => createSeedState(NOW));
    expect(s.getState().stations.length).toBe(3);
  });
});
