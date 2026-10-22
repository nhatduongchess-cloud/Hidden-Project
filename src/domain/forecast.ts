import type { AppState, Station } from './types';
import { binCapacityKg } from './constants';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
// Fixed Vietnam time: demand should not change when a dispatcher travels abroad.
const vn = (ts: number) => new Date(ts + 7 * HOUR);
const dayStart = (ts: number) => Math.floor((ts + 7 * HOUR) / DAY) * DAY - 7 * HOUR;

export interface DemandModel {
  source: 'history' | 'assumption';
  days: number;
  samples: number;
  hourlyKg: number[];
  weekdayFactors: number[];
  peakHour: number;
}

/** Smoothed hour-of-day and weekday demand, including zero-transaction days.
 * Only completed days and received records are used. This is an explainable baseline,
 * not a trained AI model. A seasonal scenario is supplied explicitly by the operator.
 */
export function demandModel(state: AppState, station: Station, now: number): DemandModel {
  const end = dayStart(Math.min(now, station.lastUpdate));
  const rows = state.transactions.filter((t) => t.stationId === station.id && t.sync === 'synced' && t.ts < end && t.ts >= end - 28 * DAY);
  const first = rows.length ? Math.min(...rows.map((t) => t.ts)) : end;
  const start = Math.max(end - 28 * DAY, dayStart(first) + DAY);
  const days = Math.max(0, Math.round((end - start) / DAY));
  const accepted = rows.filter((t) => t.ts >= start && t.status === 'accepted');
  const hours = Array<number>(24).fill(0);
  const weekdays = Array<number>(7).fill(0);
  const occurrences = Array<number>(7).fill(0);
  for (let ts = start; ts < end; ts += DAY) occurrences[vn(ts).getUTCDay()]++;
  for (const t of accepted) {
    hours[vn(t.ts).getUTCHours()] += t.acceptedMassG / 1000;
    weekdays[vn(t.ts).getUTCDay()] += t.acceptedMassG / 1000;
  }
  const totalKg = hours.reduce((a, b) => a + b, 0);
  const historical = days >= 7 && accepted.length >= 30;
  const meanDay = days ? totalKg / days : 0;
  const fallback = (station.forecastRateBph * state.settings.avgBottleMassG) / 1000;
  const hourlyKg = hours.map((v) => (historical ? (v + (2 * meanDay) / 24) / (days + 2) : fallback));
  const weekdayFactors = weekdays.map((v, i) => (historical && meanDay > 0 ? (v + 2 * meanDay) / ((occurrences[i] + 2) * meanDay) : 1));
  return {
    source: historical ? 'history' : 'assumption',
    days,
    samples: accepted.length,
    hourlyKg,
    weekdayFactors,
    peakHour: hours.indexOf(Math.max(...hours)),
  };
}

export interface Forecast {
  model: DemandModel;
  currentPct: number;
  points: { ts: number; pct: number }[];
  reaches80At: number | null;
  reaches95At: number | null;
  stale: boolean;
  paused: boolean;
}

export function forecastStation(
  state: AppState,
  station: Station,
  now = Date.now(),
  hours = 168,
  multiplier = state.settings.demandMultiplier ?? 1,
  view: 'hub' | 'station' = 'hub',
): Forecast {
  const mass = state.transactions
    .filter(
      (t) =>
        t.stationId === station.id &&
        t.binId === station.activeBinId &&
        t.status === 'accepted' &&
        (view === 'station' || t.sync === 'synced'),
    )
    .reduce((sum, t) => sum + t.acceptedMassG / 1000, 0);
  const capacity = binCapacityKg(state.settings);
  const currentPct = capacity > 0 ? (mass / capacity) * 100 : 0;
  const model = demandModel(state, station, now);
  const result: Forecast = {
    model,
    currentPct,
    points: [{ ts: now, pct: currentPct }],
    reaches80At: currentPct >= state.settings.warnPct ? now : null,
    reaches95At: currentPct >= state.settings.stopPct ? now : null,
    stale: station.connection === 'offline' || now - station.lastUpdate > 15 * 60_000,
    paused: !!station.fault,
  };
  let pct = currentPct;
  const end = now + Math.max(0, Math.min(168, hours)) * HOUR;
  // Quarter-hour integration preserves access-window boundaries and hourly/weekday changes.
  const minuteOfDay = (s: string) => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const open = minuteOfDay(station.accessWindow.start),
    close = minuteOfDay(station.accessWindow.end);
  for (let ts = now; ts < end; ) {
    const next = Math.min(end, (Math.floor(ts / 900_000) + 1) * 900_000);
    const date = vn(ts),
      minute = date.getUTCHours() * 60 + date.getUTCMinutes();
    const accessible = close > open ? minute >= open && minute < close : close < open ? minute >= open || minute < close : false;
    const delta =
      !station.fault && accessible && capacity > 0
        ? ((model.hourlyKg[date.getUTCHours()] * model.weekdayFactors[date.getUTCDay()] * Math.max(0, multiplier) * ((next - ts) / HOUR)) /
            capacity) *
          100
        : 0;
    const after = Math.max(currentPct, Math.min(state.settings.stopPct, pct + delta));
    for (const [target, key] of [
      [state.settings.warnPct, 'reaches80At'],
      [state.settings.stopPct, 'reaches95At'],
    ] as const) {
      if (result[key] === null && pct < target && after >= target && delta > 0) result[key] = ts + ((next - ts) * (target - pct)) / delta;
    }
    pct = after;
    if (next === end || next % HOUR === 0) result.points.push({ ts: next, pct });
    ts = next;
  }
  return result;
}
