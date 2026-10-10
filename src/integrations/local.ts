import type { DataRepository, TelemetrySource, RoutingProvider, MapProvider, AuthProvider, EvidenceStorage } from './types';
import type { Store } from '../domain/store';
import { planRoute } from '../domain/routing';

/** Local implementations used by the demo. No network calls, no API keys. */
export function createLocalIntegrations(store: Store) {
  const repo: DataRepository = {
    status: () => ({ id: 'data', connected: false, mode: 'local' }),
    load: () => store.getState(),
    save: () => undefined, // the store persists itself to localStorage
  };
  const telemetry: TelemetrySource = {
    status: () => ({ id: 'telemetry', connected: false, mode: 'simulated' }),
    async upload(stationId, records) {
      const before = store.getState().duplicateSyncIgnored;
      store.dispatch({ type: 'SYNC_UPLOAD', stationId, records, ts: Date.now() });
      const duplicates = store.getState().duplicateSyncIgnored - before;
      return { accepted: records.length - duplicates, duplicates };
    },
  };
  const routing: RoutingProvider = {
    status: () => ({ id: 'routing', connected: false, mode: 'simulated' }),
    plan: async (stations, cfg) => planRoute(stations, cfg),
  };
  const map: MapProvider = { status: () => ({ id: 'map', connected: false, mode: 'simulated' }) };
  const auth: AuthProvider = {
    status: () => ({ id: 'auth', connected: false, mode: 'simulated' }),
    currentRole: () => store.getState().role,
  };
  const evidence: EvidenceStorage = {
    status: () => ({ id: 'evidence', connected: false, mode: 'local' }),
    put: async (f) => ({ fileName: f.name, sizeBytes: f.size }),
  };
  return { repo, telemetry, routing, map, auth, evidence };
}
