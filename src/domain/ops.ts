import type { AppState, Station, WorkOrder, AssignedRoute, Batch, Transaction } from './types';
import { fillPct, activeBinTxs, hoursToPct } from './selectors';
import { summarizeBatch } from './report';
import { DISCREPANCY_FLAG_PCT } from './constants';

/**
 * Operational read models for RE Hub, the driver view and the mobile app.
 * RE Hub only knows what stations have synced: a disconnected station's fill is its last reading,
 * shown as stale, never as a current measurement.
 */

export type OpStatus = 'accepting' | 'warning' | 'stopped' | 'jam' | 'estop';

/** Readings older than this are treated as stale even if the link reports online. */
export const STALE_AFTER_MIN = 15;
/** Planning horizon for "will reach 80 % before the next run" (hours, illustrative). */
export const NEXT_RUN_HOURS = 12;

export interface StationOps {
  station: Station;
  op: OpStatus;
  conn: 'online' | 'offline';
  stale: boolean;
  /** Fill as last received by RE Hub (synced records only). */
  hubFillPct: number;
  lastReadingTs: number;
  minutesSinceReading: number;
  binKg: number;
  binBottles: number;
  todayBottles: number;
  todayRejected: number;
  hoursTo80: number | null;
  hoursTo95: number | null;
}

export function stationOps(state: AppState, station: Station, now = Date.now()): StationOps {
  const hubFillPct = fillPct(state, station, 'hub');
  const { warnPct, stopPct } = state.settings;
  const op: OpStatus = station.fault
    ? station.fault
    : hubFillPct >= stopPct
      ? 'stopped'
      : hubFillPct >= warnPct
        ? 'warning'
        : 'accepting';
  const minutesSinceReading = Math.max(0, (now - station.lastUpdate) / 60_000);
  const stale = station.connection === 'offline' || minutesSinceReading > STALE_AFTER_MIN;
  const bin = activeBinTxs(state, station, 'hub');
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  let todayBottles = 0;
  let todayRejected = 0;
  for (const t of state.transactions) {
    if (t.stationId !== station.id || t.sync !== 'synced' || t.ts < dayStart.getTime()) continue;
    if (t.status === 'accepted') todayBottles++;
    else if (t.status === 'rejected') todayRejected++;
  }
  return {
    station,
    op,
    conn: station.connection,
    stale,
    hubFillPct,
    lastReadingTs: station.lastUpdate,
    minutesSinceReading,
    binKg: bin.reduce((s, t) => s + t.acceptedMassG, 0) / 1000,
    binBottles: bin.length,
    todayBottles,
    todayRejected,
    hoursTo80: hoursToPct(state, station, warnPct, 'hub'),
    hoursTo95: hoursToPct(state, station, stopPct, 'hub'),
  };
}

export function allStationOps(state: AppState, now = Date.now()): StationOps[] {
  return state.stations.map((s) => stationOps(state, s, now));
}

export type AttentionKind = 'estop' | 'jam' | 'full' | 'offline' | 'warning' | 'forecast';
export type Severity = 'stop' | 'stale' | 'warn';

export interface AttentionItem {
  stationId: string;
  kind: AttentionKind;
  severity: Severity;
  /** Additional reasons for the same station, lower priority than `kind`. */
  also: AttentionKind[];
  ops: StationOps;
  collectionTask?: WorkOrder;
  maintenanceTask?: WorkOrder;
  route?: AssignedRoute;
}

const SEVERITY_RANK: Record<Severity, number> = { stop: 0, stale: 1, warn: 2 };
const KIND_SEVERITY: Record<AttentionKind, Severity> = {
  estop: 'stop',
  jam: 'stop',
  full: 'stop',
  offline: 'stale',
  warning: 'warn',
  forecast: 'warn',
};

const KIND_RANK: Record<AttentionKind, number> = { estop: 0, jam: 1, full: 2, offline: 3, warning: 4, forecast: 5 };

export function openTask(state: AppState, stationId: string, kind: WorkOrder['kind']): WorkOrder | undefined {
  return state.tasks.find((t) => t.stationId === stationId && t.kind === kind && t.status !== 'done');
}

export function activeRoute(state: AppState): AssignedRoute | undefined {
  return state.routes.find((r) => r.status !== 'done');
}

/** Stations that need an operator, most urgent first. One item per station with its secondary reasons. */
export function attentionItems(state: AppState, now = Date.now()): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const ops of allStationOps(state, now)) {
    const kinds: AttentionKind[] = [];
    if (ops.station.fault) kinds.push(ops.station.fault);
    if (ops.op === 'stopped') kinds.push('full');
    if (ops.conn === 'offline') kinds.push('offline');
    if (ops.op === 'warning') kinds.push('warning');
    else if (ops.op === 'accepting' && ops.hoursTo80 !== null && ops.hoursTo80 <= NEXT_RUN_HOURS) kinds.push('forecast');
    if (!kinds.length) continue;
    kinds.sort((a, b) => SEVERITY_RANK[KIND_SEVERITY[a]] - SEVERITY_RANK[KIND_SEVERITY[b]]);
    const collectionTask = openTask(state, ops.station.id, 'collection');
    const route = collectionTask?.routeId ? state.routes.find((r) => r.id === collectionTask.routeId) : undefined;
    out.push({
      stationId: ops.station.id,
      kind: kinds[0],
      severity: KIND_SEVERITY[kinds[0]],
      also: kinds.slice(1),
      ops,
      collectionTask,
      maintenanceTask: openTask(state, ops.station.id, 'maintenance'),
      route,
    });
  }
  // Within a severity, faults outrank a full bin (they may be safety-related), then fuller bins first.
  return out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.ops.hubFillPct - a.ops.hubFillPct);
}

/* ---------- Traceability ---------- */

export type StageKey = 'station' | 'pickup' | 'weighed' | 'handover' | 'downstream';
export interface Stage {
  key: StageKey;
  status: 'done' | 'pending' | 'missing';
  ts?: number;
}

export function batchStages(state: AppState, b: Batch): Stage[] {
  const cols = state.collections.filter((c) => c.batchId === b.id);
  const firstTx = cols.length
    ? Math.min(...cols.flatMap((c) => c.txIds.map((id) => state.transactions.find((t) => t.id === id)?.ts ?? c.ts)))
    : undefined;
  const lastCol = cols.length ? Math.max(...cols.map((c) => c.ts)) : undefined;
  const hasDoc = b.evidence.some((e) => e.kind === 'recycler_document');
  return [
    { key: 'station', status: cols.length ? 'done' : 'pending', ts: firstTx },
    { key: 'pickup', status: cols.length ? 'done' : 'pending', ts: lastCol },
    { key: 'weighed', status: b.receiving ? 'done' : 'pending', ts: b.receiving?.ts },
    { key: 'handover', status: b.handover ? 'done' : 'pending', ts: b.handover?.ts },
    {
      key: 'downstream',
      status: b.downstream ? 'done' : b.handover && !hasDoc ? 'missing' : 'pending',
      ts: b.downstream?.ts,
    },
  ];
}

export type GapKind = 'discrepancy' | 'no_weigh_ticket' | 'no_handover' | 'no_recycler_doc' | 'no_downstream' | 'pending_records';
export interface Gap {
  kind: GapKind;
  severity: 'warn' | 'info';
  value?: number;
}

export function batchGaps(state: AppState, b: Batch, now = Date.now()): Gap[] {
  const s = summarizeBatch(state, b);
  const gaps: Gap[] = [];
  const cols = state.collections.filter((c) => c.batchId === b.id);
  const ids = new Set(cols.flatMap((c) => c.txIds));
  const pending = state.transactions.filter((t) => ids.has(t.id) && t.sync === 'pending').length;
  if (pending) gaps.push({ kind: 'pending_records', severity: 'warn', value: pending });
  if (s.discrepancyPct !== null && Math.abs(s.discrepancyPct) > DISCREPANCY_FLAG_PCT) gaps.push({ kind: 'discrepancy', severity: 'warn', value: s.discrepancyPct });
  const lastCol = cols.length ? Math.max(...cols.map((c) => c.ts)) : now;
  if (!b.receiving && cols.length) gaps.push({ kind: 'no_weigh_ticket', severity: now - lastCol > 24 * 3_600_000 ? 'warn' : 'info' });
  if (b.receiving && !b.handover) gaps.push({ kind: 'no_handover', severity: 'info' });
  if (b.handover && !s.hasRecyclerDocument) gaps.push({ kind: 'no_recycler_doc', severity: 'warn' });
  if (b.handover && s.hasRecyclerDocument && !b.downstream) gaps.push({ kind: 'no_downstream', severity: 'info' });
  return gaps;
}

/** Brand attribution inside a batch: bottles and estimated mass by barcode. Weighed mass is per batch only. */
export function batchBrandShare(state: AppState, b: Batch, brand: string) {
  const cols = state.collections.filter((c) => c.batchId === b.id);
  const ids = new Set(cols.flatMap((c) => c.txIds));
  let bottles = 0;
  let g = 0;
  let total = 0;
  for (const t of state.transactions) {
    if (!ids.has(t.id)) continue;
    total++;
    if (t.brand === brand) {
      bottles++;
      g += t.acceptedMassG;
    }
  }
  return { bottles, estKg: g / 1000, sharePct: total ? (bottles / total) * 100 : 0 };
}

/* ---------- Mobile user ---------- */

export interface UserStats {
  creditedPoints: number;
  pendingPoints: number;
  acceptedBottles: number;
  returnedItems: number;
  estimatedKg: number;
  recent: Transaction[];
}

export function userStats(state: AppState, userId: string, recentN = 30): UserStats {
  let creditedPoints = 0,
    pendingPoints = 0,
    acceptedBottles = 0,
    returnedItems = 0,
    g = 0;
  const mine: Transaction[] = [];
  for (const t of state.transactions) {
    if (t.userId !== userId) continue;
    mine.push(t);
    if (t.status === 'accepted') {
      acceptedBottles++;
      g += t.acceptedMassG;
      if (t.sync === 'synced') creditedPoints += t.points;
      else pendingPoints += t.points;
    } else if (t.status === 'rejected') returnedItems++;
  }
  mine.sort((a, b) => b.ts - a.ts);
  return { creditedPoints, pendingPoints, acceptedBottles, returnedItems, estimatedKg: g / 1000, recent: mine.slice(0, recentN) };
}

/** What a user standing at the station sees: the station's own state, regardless of RE Hub's link. */
export function userStationAvailability(state: AppState, station: Station): 'open' | 'stopped' | 'fault' | 'unknown' {
  // The app learns availability through RE Hub; a station that stopped reporting is shown as unknown.
  if (station.connection === 'offline') return 'unknown';
  if (station.fault) return 'fault';
  if (fillPct(state, station, 'hub') >= state.settings.stopPct) return 'stopped';
  return 'open';
}
