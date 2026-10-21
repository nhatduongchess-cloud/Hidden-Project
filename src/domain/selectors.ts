import type { AppState, Station, Transaction, Material, BrandId, Settings } from './types';
import { binCapacityKg } from './constants';
import { forecastStation } from './forecast';

export type FillView = 'station' | 'hub';

/** Accepted transactions currently in the station's active bin. 'hub' view only counts synced records. */
export function activeBinTxs(state: AppState, station: Station, view: FillView = 'station'): Transaction[] {
  return state.transactions.filter(
    (t) =>
      t.stationId === station.id &&
      t.binId === station.activeBinId &&
      t.status === 'accepted' &&
      (view === 'station' || t.sync === 'synced'),
  );
}

export function activeBinMassKg(state: AppState, station: Station, view: FillView = 'station'): number {
  return activeBinTxs(state, station, view).reduce((s, t) => s + t.acceptedMassG, 0) / 1000;
}

/**
 * Simulation assumption: fill % = accepted mass in bin ÷ (compacted density × bin volume).
 * A real station would report fill from its two ultrasonic sensors.
 */
export function fillPct(state: AppState, station: Station, view: FillView = 'station'): number {
  return (activeBinMassKg(state, station, view) / binCapacityKg(state.settings)) * 100;
}

export function fillIncrementPct(settings: Settings): number {
  return (settings.avgBottleMassG / 1000 / binCapacityKg(settings)) * 100;
}

export type StationHealth = 'estop' | 'jam' | 'full' | 'warning' | 'offline' | 'ok';

export function stationHealth(state: AppState, station: Station, view: FillView = 'station'): StationHealth {
  if (station.fault === 'estop') return 'estop';
  if (station.fault === 'jam') return 'jam';
  const f = fillPct(state, station, view);
  if (f >= state.settings.stopPct) return 'full';
  if (f >= state.settings.warnPct) return 'warning';
  if (station.connection === 'offline') return 'offline';
  return 'ok';
}

/** Whether the station may start processing another bottle (pre-check before each item). */
export function canAcceptNext(state: AppState, station: Station): { ok: true } | { ok: false; why: 'fault' | 'full' | 'capacity' } {
  if (station.fault) return { ok: false, why: 'fault' };
  const f = fillPct(state, station, 'station');
  if (f >= state.settings.stopPct) return { ok: false, why: 'full' };
  if (f + fillIncrementPct(state.settings) > 100) return { ok: false, why: 'capacity' };
  return { ok: true };
}

/** Calendar hours to threshold using received history; assumptions only for sparse history. */
export function hoursToPct(state: AppState, station: Station, targetPct: number, view: FillView = 'hub'): number | null {
  const now = Date.now();
  const f = forecastStation(state, station, now, 168, state.settings.demandMultiplier ?? 1, view);
  if (f.currentPct >= targetPct) return 0;
  const ts = targetPct === state.settings.warnPct ? f.reaches80At : targetPct === state.settings.stopPct ? f.reaches95At : f.points.find(p => p.pct >= targetPct)?.ts;
  return ts == null ? null : (ts - now) / 3_600_000;
}

export function forecastPctAfter(state: AppState, station: Station, hours: number, view: FillView = 'hub'): number {
  return forecastStation(state, station, Date.now(), hours, state.settings.demandMultiplier ?? 1, view).points.at(-1)!.pct;
}

export interface TxFilters {
  stationId: string | 'all';
  material: Material | 'all';
  brand: BrandId | 'all';
  /** yyyy-mm-dd inclusive, local time; empty string = open */
  from: string;
  to: string;
}

export const EMPTY_FILTERS: TxFilters = { stationId: 'all', material: 'all', brand: 'all', from: '', to: '' };

function dayStart(s: string): number {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function filterTxs(state: AppState, f: TxFilters, opts: { includePending?: boolean } = {}): Transaction[] {
  const from = f.from ? dayStart(f.from) : -Infinity;
  const to = f.to ? dayStart(f.to) + 86_400_000 : Infinity;
  const brand = state.role === 'brand' ? state.brandView : f.brand;
  return state.transactions.filter(
    (t) =>
      (opts.includePending !== false || t.sync === 'synced') &&
      (f.stationId === 'all' || t.stationId === f.stationId) &&
      (f.material === 'all' || t.material === f.material) &&
      (brand === 'all' || t.brand === brand) &&
      t.ts >= from &&
      t.ts < to,
  );
}

export interface Totals {
  acceptedBottles: number;
  acceptedKg: number;
  rejected: number;
  aborted: number;
  rejectionRatePct: number;
  points: number;
  pendingRecords: number;
  pendingPoints: number;
}

export function totals(txs: Transaction[]): Totals {
  let acceptedBottles = 0,
    acceptedG = 0,
    rejected = 0,
    aborted = 0,
    points = 0,
    pendingRecords = 0,
    pendingPoints = 0;
  for (const t of txs) {
    if (t.status === 'accepted') {
      acceptedBottles++;
      acceptedG += t.acceptedMassG;
      if (t.sync === 'synced') points += t.points;
      else pendingPoints += t.points;
    } else if (t.status === 'rejected') rejected++;
    else aborted++;
    if (t.sync === 'pending') pendingRecords++;
  }
  const decided = acceptedBottles + rejected;
  return {
    acceptedBottles,
    acceptedKg: acceptedG / 1000,
    rejected,
    aborted,
    rejectionRatePct: decided ? (rejected / decided) * 100 : 0,
    points,
    pendingRecords,
    pendingPoints,
  };
}

export function dailySeries(txs: Transaction[], days: number, now = Date.now()) {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const out: { day: number; kg: number; bottles: number; rejected: number }[] = [];
  for (let i = days - 1; i >= 0; i--) out.push({ day: end.getTime() - i * 86_400_000, kg: 0, bottles: 0, rejected: 0 });
  for (const t of txs) {
    const d = new Date(t.ts);
    d.setHours(0, 0, 0, 0);
    const slot = out.find((o) => o.day === d.getTime());
    if (!slot) continue;
    if (t.status === 'accepted') {
      slot.kg += t.acceptedMassG / 1000;
      slot.bottles++;
    } else if (t.status === 'rejected') slot.rejected++;
  }
  return out;
}

export function userBalances(state: AppState) {
  const map = new Map<string, { credited: number; pending: number; bottles: number }>();
  for (const u of state.users) map.set(u.id, { credited: 0, pending: 0, bottles: 0 });
  for (const t of state.transactions) {
    if (t.status !== 'accepted') continue;
    const b = map.get(t.userId) ?? { credited: 0, pending: 0, bottles: 0 };
    b.bottles++;
    if (t.sync === 'synced') b.credited += t.points;
    else b.pending += t.points;
    map.set(t.userId, b);
  }
  return map;
}

/** Lifetime accepted totals per station (never reset by collection). */
export function lifetimeByStation(state: AppState, stationId: string) {
  return totals(state.transactions.filter((t) => t.stationId === stationId));
}

export function batchEstimatedKg(state: AppState, batchId: string): number {
  return state.collections.filter((c) => c.batchId === batchId).reduce((s, c) => s + c.estimatedKg, 0);
}
