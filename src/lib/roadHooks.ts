import { useEffect, useMemo, useState } from 'react';
import { estimateMatrix, fetchMatrix, fetchRoute, type Fetched, type Matrix } from '../integrations/roadRouting';
import type { RoadRoute } from '../domain/nav';
import type { LatLng } from '../domain/geo';
import type { AppState } from '../domain/types';
import { DEPOT, PARTNER, matrixMetric, type Metric } from '../domain/routing';
import { pointOf } from '../domain/places';

/**
 * React hooks over the road-routing client. Requests run from the browser, are cancelled when
 * the inputs change, and fall back to a labelled straight-line estimate when no service answers.
 */

const keyOf = (pts: LatLng[]) => pts.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');

export interface Loaded<T> {
  /** Result for the current inputs, null while loading. */
  value: T | null;
  /** Last result for any inputs, kept on screen while a new one loads (e.g. a reroute). */
  last: T | null;
  loading: boolean;
  failed: Fetched<T>['failed'];
}

export function useRoadRoute(points: LatLng[] | null, nonce = 0): Loaded<RoadRoute> {
  const key = points && points.length >= 2 ? `${keyOf(points)}#${nonce}` : '';
  const [st, setSt] = useState<{ key: string; value: RoadRoute | null; failed: Fetched<RoadRoute>['failed'] }>({ key: '', value: null, failed: [] });
  useEffect(() => {
    if (!key || !points) return;
    const ctrl = new AbortController();
    fetchRoute(points, { signal: ctrl.signal })
      .then((r) => !ctrl.signal.aborted && setSt({ key, value: r.value, failed: r.failed }))
      .catch(() => undefined);
    return () => ctrl.abort();
    // `key` encodes the points, so it is the only dependency.
  }, [key]);
  const fresh = st.key === key;
  return { value: fresh ? st.value : null, last: st.value, loading: !!key && !fresh, failed: fresh ? st.failed : [] };
}

export function useMatrix(sources: LatLng[], targets: LatLng[]): Loaded<Matrix> {
  const key = sources.length && targets.length ? `${keyOf(sources)}>${keyOf(targets)}` : '';
  const [st, setSt] = useState<{ key: string; value: Matrix | null; failed: Fetched<Matrix>['failed'] }>({ key: '', value: null, failed: [] });
  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    fetchMatrix(sources, targets, { signal: ctrl.signal })
      .then((r) => !ctrl.signal.aborted && setSt({ key, value: r.value, failed: r.failed }))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [key]);
  const fresh = st.key === key;
  return { value: fresh ? st.value : null, last: st.value, loading: !!key && !fresh, failed: fresh ? st.failed : [] };
}

/** Planner ids in matrix order: depot, every station, partner. */
export function plannerIds(state: AppState): string[] {
  return [DEPOT, ...state.stations.map((s) => s.id), PARTNER];
}

export interface RoadMetric {
  metric: Metric;
  /** Which service answered; 'estimate' also while loading. */
  provider: Matrix['provider'];
  loading: boolean;
  failed: Fetched<Matrix>['failed'];
}

/**
 * Travel times between the depot, every station and the partner, for the route planner.
 * Until the service answers (or if it cannot), a straight-line estimate from the same
 * coordinates is used, so the plan always matches what the map shows.
 */
export function useRoadMetric(state: AppState): RoadMetric {
  const all = plannerIds(state).map((id) => [id, pointOf(state, id)!] as const);
  const coordKey = all.map(([id, p]) => `${id}@${p.lat},${p.lng}`).join('|');
  // Only a moved or added point changes the inputs.
  const { ids, pts } = useMemo(
    () => ({ ids: all.map(([id]) => id), pts: all.map(([, p]) => ({ lat: p.lat, lng: p.lng })) }),
    [coordKey],
  );
  const m = useMatrix(pts, pts);
  return useMemo(() => {
    if (m.value) {
      const source = m.value.provider === 'estimate' ? 'estimate' : 'road';
      return { metric: matrixMetric(ids, m.value.durationsS, m.value.distancesM, source), provider: m.value.provider, loading: false, failed: m.failed };
    }
    const est = estimateMatrix(pts, pts);
    return { metric: matrixMetric(ids, est.durationsS, est.distancesM, 'estimate'), provider: 'estimate', loading: m.loading, failed: [] };
  }, [m.value, m.loading, ids, pts]);
}
