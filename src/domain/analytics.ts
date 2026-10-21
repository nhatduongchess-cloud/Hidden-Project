import type { AppState, Transaction } from './types';
import { totals } from './selectors';

export function groupCollections(rows: Transaction[], key: (row: Transaction) => string) {
  const groups = new Map<string, Transaction[]>();
  for (const t of rows) groups.set(key(t), [...(groups.get(key(t)) ?? []), t]);
  return [...groups].map(([id, txs]) => ({ id, ...totals(txs) })).sort((a, b) => b.acceptedKg - a.acceptedKg);
}

/** Recorded full-bin intervals, clipped to the reporting range. No inferred downtime. */
export function fullStationHours(state: AppState, from: number, to: number, stationId = 'all') {
  let hours = 0;
  let intervals = 0;
  for (const st of state.stations.filter((s) => stationId === 'all' || s.id === stationId)) {
    const events = [
      ...state.log.filter((l) => l.stationId === st.id && l.text === 'stop_reached').map((l) => ({ ts: l.ts, full: true })),
      ...state.collections.filter((c) => c.stationId === st.id).map((c) => ({ ts: c.ts, full: false })),
    ]
      .filter((e) => e.ts <= to)
      .sort((a, b) => a.ts - b.ts);
    let since: number | null = null;
    for (const e of events) {
      if (e.full && since === null) since = e.ts;
      if (!e.full && since !== null) {
        if (e.ts > from) {
          hours += Math.max(0, e.ts - Math.max(from, since)) / 3_600_000;
          intervals++;
        }
        since = null;
      }
    }
    if (since !== null && to > Math.max(from, since)) {
      hours += (to - Math.max(from, since)) / 3_600_000;
      intervals++;
    }
  }
  return { hours, intervals };
}

export function operatingKpis(state: AppState, from: number, to: number, costPerKm: number, costPerTrip: number) {
  const collections = state.collections.filter((c) => c.ts >= from && c.ts <= to);
  const routes = state.routes.filter(
    (r) => r.status === 'done' && r.finishedAt !== undefined && r.finishedAt >= from && r.finishedAt <= to,
  );
  const collectionIds = new Set(
    routes.flatMap((r) => r.stops.filter((s) => s.status === 'done' && s.collectionId).map((s) => s.collectionId!)),
  );
  // Join by collection ID, not estimated mass at planning time; skipped stops contribute nothing.
  const matchedKg = state.collections.filter((c) => collectionIds.has(c.id)).reduce((sum, c) => sum + c.estimatedKg, 0);
  const km = routes.reduce((sum, r) => sum + r.distanceKm, 0);
  const cost = km * costPerKm + routes.length * costPerTrip;
  const tx = state.transactions.filter((t) => t.sync === 'synced' && t.ts >= from && t.ts <= to);
  return {
    routes: routes.length,
    matchedKg,
    km,
    cost,
    costPerKg: matchedKg > 0 ? cost / matchedKg : null,
    kgPerKm: km > 0 && matchedKg > 0 ? matchedKg / km : null,
    pickupPct: collections.length ? collections.reduce((sum, c) => sum + c.fillPctAtPickup, 0) / collections.length : null,
    pickups: collections.length,
    full: fullStationHours(state, from, to),
    rejectionRatePct: totals(tx).rejectionRatePct,
  };
}
