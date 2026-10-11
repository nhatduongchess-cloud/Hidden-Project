import type { AppState, Transaction, Settings, Station, Evidence, Batch, CollectionRecord, WorkOrder, AssignedRoute } from './types';
import { fillPct } from './selectors';
import { newId } from './ids';
import { DEFAULT_SETTINGS } from './constants';
import { AREAS, areaById, type ServiceArea } from './areas';

export type Action =
  | { type: 'COMMIT_ACCEPTED'; tx: Transaction }
  | { type: 'RECORD_ITEM'; tx: Transaction }
  | { type: 'SET_FAULT'; stationId: string; fault: 'jam' | 'estop'; ts: number }
  | { type: 'CLEAR_FAULT'; stationId: string; ts: number }
  | { type: 'SET_CONNECTION'; stationId: string; connection: 'online' | 'offline'; ts: number }
  | { type: 'SYNC_UPLOAD'; stationId: string; records: Transaction[]; ts: number }
  | { type: 'CONFIRM_COLLECTION'; stationId: string; driver: string; ts: number; collectionId: string; newBinId: string; routeId?: string }
  | { type: 'CREATE_TASK'; task: Omit<WorkOrder, 'id'> & { id?: string } }
  | { type: 'UPDATE_TASK'; taskId: string; patch: Partial<Pick<WorkOrder, 'status' | 'scheduledFor' | 'assignee' | 'note' | 'routeId'>> }
  | { type: 'RESOLVE_TASK'; taskId: string; ts: number; resolution: string }
  | { type: 'ASSIGN_ROUTE'; route: AssignedRoute; ts: number }
  | { type: 'START_ROUTE'; routeId: string }
  | { type: 'SKIP_STOP'; routeId: string; stationId: string; reason: string }
  | { type: 'FINISH_ROUTE'; routeId: string; ts: number }
  | { type: 'CANCEL_ROUTE'; routeId: string; ts: number }
  | { type: 'SET_CURRENT_USER'; userId: string }
  | { type: 'BATCH_RECEIVE'; batchId: string; measuredKg: number; ticketNo: string; ts: number }
  | { type: 'BATCH_HANDOVER'; batchId: string; partner: string; ts: number }
  | { type: 'BATCH_ATTACH_EVIDENCE'; batchId: string; evidence: Evidence }
  | { type: 'BATCH_RECORD_DOWNSTREAM'; batchId: string; confirmedKg: number; note: string; ts: number }
  | { type: 'UPDATE_SETTINGS'; patch: Partial<Settings> }
  | { type: 'UPDATE_STATION'; stationId: string; patch: Partial<Pick<Station, 'accessWindow' | 'forecastRateBph'>> }
  | { type: 'SET_ROLE'; role: AppState['role']; brandView?: AppState['brandView'] }
  /** Move a station, the depot or the partner on the map ('DEPOT' / 'PARTNER'). */
  | { type: 'SET_LOCATION'; target: string; lat: number; lng: number }
  /** Where the collection truck is (last stop, GPS fix or simulated drive). */
  | { type: 'SET_DRIVER_POS'; pos: { lat: number; lng: number } | null }
  | { type: 'RESET_LOCATIONS' }
  /** Move the stations, depot, receiving point and zone to another illustrative city. */
  | { type: 'APPLY_AREA'; areaId: string; keepDriverPos?: boolean }
  | { type: 'REPLACE_STATE'; state: AppState };

const MAX_LOG = 60;

function withLog(s: AppState, entry: AppState['log'][number]): AppState {
  return { ...s, log: [entry, ...s.log].slice(0, MAX_LOG) };
}

function mapStation(s: AppState, id: string, fn: (st: Station) => Station): AppState {
  return { ...s, stations: s.stations.map((st) => (st.id === id ? fn(st) : st)) };
}

function mapBatch(s: AppState, id: string, fn: (b: Batch) => Batch): AppState {
  return { ...s, batches: s.batches.map((b) => (b.id === id ? fn(b) : b)) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'COMMIT_ACCEPTED': {
      const { tx } = action;
      // Idempotent: a transaction id is credited at most once.
      if (state.transactions.some((t) => t.id === tx.id)) return state;
      const station = state.stations.find((s) => s.id === tx.stationId);
      if (!station || station.fault) return state; // faults stop processing; no credit
      if (tx.status !== 'accepted' || tx.binId !== station.activeBinId) return state;
      const before = fillPct(state, station);
      const sync = station.connection === 'online' ? 'synced' : 'pending';
      let next: AppState = {
        ...state,
        transactions: [...state.transactions, { ...tx, sync }],
      };
      next = mapStation(next, station.id, (st) => ({ ...st, lastUpdate: sync === 'synced' ? tx.ts : st.lastUpdate }));
      const after = fillPct(next, station);
      if (before < state.settings.warnPct && after >= state.settings.warnPct)
        next = withLog(next, { ts: tx.ts, stationId: station.id, level: 'warn', text: 'warn_crossed' });
      if (before < state.settings.stopPct && after >= state.settings.stopPct)
        next = withLog(next, { ts: tx.ts, stationId: station.id, level: 'error', text: 'stop_reached' });
      return next;
    }
    case 'RECORD_ITEM': {
      const { tx } = action;
      if (state.transactions.some((t) => t.id === tx.id)) return state;
      const station = state.stations.find((s) => s.id === tx.stationId);
      if (!station) return state;
      // Rejected/aborted items never carry mass or points.
      const clean: Transaction = {
        ...tx,
        acceptedMassG: 0,
        points: 0,
        sync: station.connection === 'online' ? 'synced' : 'pending',
      };
      return { ...state, transactions: [...state.transactions, clean] };
    }
    case 'SET_FAULT': {
      let next = mapStation(state, action.stationId, (st) => ({ ...st, fault: action.fault }));
      next = withLog(next, { ts: action.ts, stationId: action.stationId, level: 'error', text: `fault_${action.fault}` });
      return next;
    }
    case 'CLEAR_FAULT': {
      const st = state.stations.find((s) => s.id === action.stationId);
      if (!st?.fault) return state;
      let next = mapStation(state, action.stationId, (s) => ({ ...s, fault: null }));
      next = withLog(next, { ts: action.ts, stationId: action.stationId, level: 'info', text: `cleared_${st.fault}` });
      return next;
    }
    case 'SET_CONNECTION': {
      let next = mapStation(state, action.stationId, (st) => ({
        ...st,
        connection: action.connection,
        lastUpdate: action.connection === 'online' ? action.ts : st.lastUpdate,
      }));
      next = withLog(next, {
        ts: action.ts,
        stationId: action.stationId,
        level: action.connection === 'online' ? 'info' : 'warn',
        text: `conn_${action.connection}`,
      });
      return next;
    }
    case 'SYNC_UPLOAD': {
      const st = state.stations.find((s) => s.id === action.stationId);
      if (!st || st.connection !== 'online') return state;
      let dup = 0;
      const ids = new Set(action.records.map((r) => r.id));
      const seen = new Set<string>();
      for (const r of action.records) {
        const existing = state.transactions.find((t) => t.id === r.id);
        if (!existing || existing.sync === 'synced' || seen.has(r.id)) dup++;
        seen.add(r.id);
      }
      const transactions = state.transactions.map((t) => (ids.has(t.id) && t.sync === 'pending' ? { ...t, sync: 'synced' as const } : t));
      const synced = transactions.filter((t, i) => t.sync !== state.transactions[i].sync).length;
      let next: AppState = {
        ...state,
        transactions,
        duplicateSyncIgnored: state.duplicateSyncIgnored + dup,
      };
      next = mapStation(next, st.id, (s) => ({ ...s, lastUpdate: action.ts }));
      next = withLog(next, { ts: action.ts, stationId: st.id, level: 'info', text: `synced:${synced}:${dup}` });
      return next;
    }
    case 'CONFIRM_COLLECTION': {
      const st = state.stations.find((s) => s.id === action.stationId);
      if (!st) return state;
      if (state.collections.some((c) => c.id === action.collectionId)) return state;
      const binTxs = state.transactions.filter(
        (t) => t.stationId === st.id && t.binId === st.activeBinId && t.status === 'accepted',
      );
      let batches = state.batches;
      let open = batches.find((b) => b.status === 'open');
      if (!open) {
        open = { id: nextBatchId(state), createdAt: action.ts, collectionIds: [], status: 'open', evidence: [] };
        batches = [...batches, open];
      }
      const estimatedKg = binTxs.reduce((s, t) => s + t.acceptedMassG, 0) / 1000;
      const rec: CollectionRecord = {
        id: action.collectionId,
        stationId: st.id,
        binId: st.activeBinId,
        ts: action.ts,
        driver: action.driver,
        bottleCount: binTxs.length,
        estimatedKg,
        fillPctAtPickup: fillPct(state, st),
        txIds: binTxs.map((t) => t.id),
        batchId: open.id,
      };
      const openId = open.id;
      const txIdSet = new Set(rec.txIds);
      let next: AppState = {
        ...state,
        batches: batches.map((b) =>
          b.id === openId
            ? {
                ...b,
                collectionIds: [...b.collectionIds, rec.id],
                evidence: [
                  ...b.evidence,
                  {
                    id: newId('EV'),
                    kind: 'collection_note',
                    label: `collection:${st.id}:${rec.bottleCount}`,
                    fileName: `${rec.id}.json`,
                    ts: action.ts,
                    origin: 'generated',
                  },
                ],
              }
            : b,
        ),
        collections: [...state.collections, rec],
        transactions: state.transactions.map((t) => (txIdSet.has(t.id) ? { ...t, collectionId: rec.id } : t)),
      };
      // Replace the active bin: fill restarts at 0, history and lifetime totals stay.
      next = mapStation(next, st.id, (s) => ({ ...s, activeBinId: action.newBinId, binOpenedAt: action.ts }));
      next = withLog(next, { ts: action.ts, stationId: st.id, level: 'info', text: `collected:${rec.bottleCount}` });
      // The truck is now at this station.
      next = { ...next, driverPos: { lat: st.lat, lng: st.lng } };
      // Close open collection work orders for this station.
      next = {
        ...next,
        tasks: next.tasks.map((t) =>
          t.stationId === st.id && t.kind === 'collection' && t.status !== 'done'
            ? { ...t, status: 'done', resolvedAt: action.ts, resolution: `bin_swapped:${rec.id}` }
            : t,
        ),
      };
      if (action.routeId) {
        next = mapRoute(next, action.routeId, (r) => ({
          ...r,
          status: 'in_progress',
          stops: r.stops.map((sp) => (sp.stationId === st.id && sp.status === 'pending' ? { ...sp, status: 'done', collectionId: rec.id, doneAt: action.ts } : sp)),
        }));
      }
      return next;
    }
    case 'BATCH_RECEIVE': {
      const b = state.batches.find((x) => x.id === action.batchId);
      if (!b || b.status !== 'open' || b.collectionIds.length === 0 || !(action.measuredKg >= 0)) return state;
      return mapBatch(state, b.id, (x) => ({
        ...x,
        status: 'received',
        receiving: { measuredKg: action.measuredKg, ts: action.ts, ticketNo: action.ticketNo },
        evidence: [
          ...x.evidence,
          { id: newId('EV'), kind: 'weigh_ticket', label: action.ticketNo, fileName: `${action.ticketNo}.pdf`, ts: action.ts, origin: 'generated' },
        ],
      }));
    }
    case 'BATCH_HANDOVER': {
      const b = state.batches.find((x) => x.id === action.batchId);
      if (!b || b.status !== 'received') return state;
      return mapBatch(state, b.id, (x) => ({
        ...x,
        status: 'handed_over',
        handover: { partner: action.partner, ts: action.ts },
        evidence: [
          ...x.evidence,
          { id: newId('EV'), kind: 'handover_note', label: action.partner, fileName: `BG-${b.id}.pdf`, ts: action.ts, origin: 'generated' },
        ],
      }));
    }
    case 'BATCH_ATTACH_EVIDENCE':
      return mapBatch(state, action.batchId, (x) =>
        x.evidence.some((e) => e.id === action.evidence.id) ? x : { ...x, evidence: [...x.evidence, action.evidence] },
      );
    case 'BATCH_RECORD_DOWNSTREAM': {
      const b = state.batches.find((x) => x.id === action.batchId);
      // A downstream outcome needs a recycler document and a completed handover. Never set automatically.
      if (!b || b.status !== 'handed_over' || !b.evidence.some((e) => e.kind === 'recycler_document')) return state;
      if (!(action.confirmedKg >= 0)) return state;
      return mapBatch(state, b.id, (x) => ({ ...x, downstream: { confirmedKg: action.confirmedKg, ts: action.ts, note: action.note } }));
    }
    case 'CREATE_TASK': {
      const id = action.task.id ?? nextTaskId(state);
      if (state.tasks.some((t) => t.id === id)) return state;
      return { ...state, tasks: [...state.tasks, { ...action.task, id }] };
    }
    case 'UPDATE_TASK':
      return { ...state, tasks: state.tasks.map((t) => (t.id === action.taskId && t.status !== 'done' ? { ...t, ...action.patch } : t)) };
    case 'RESOLVE_TASK': {
      const task = state.tasks.find((t) => t.id === action.taskId);
      if (!task || task.status === 'done') return state;
      const st = state.stations.find((s) => s.id === task.stationId);
      if (!st) return state;
      // A connectivity work order can only be closed once the station reports again.
      if (task.reason === 'offline' && st.connection !== 'online') return state;
      let next: AppState = {
        ...state,
        tasks: state.tasks.map((t) => (t.id === task.id ? { ...t, status: 'done', resolvedAt: action.ts, resolution: action.resolution } : t)),
      };
      // Confirming a fault repair re-enables the station (the technician reset it on site).
      if (task.kind === 'maintenance' && st.fault && (task.reason === st.fault || task.reason === 'other')) {
        next = mapStation(next, st.id, (x) => ({ ...x, fault: null }));
        next = withLog(next, { ts: action.ts, stationId: st.id, level: 'info', text: `cleared_${st.fault}` });
      }
      return next;
    }
    case 'ASSIGN_ROUTE': {
      if (state.routes.some((r) => r.id === action.route.id)) return state;
      // Only one active route at a time in the demo: a new assignment replaces an unstarted one.
      let next: AppState = {
        ...state,
        routes: [...state.routes.filter((r) => !(r.status === 'assigned')), action.route],
      };
      let n = state.tasks.reduce((m, t) => Math.max(m, Number(t.id.replace(/\D/g, '')) || 0), 0);
      for (const sp of action.route.stops) {
        const open = next.tasks.find((t) => t.stationId === sp.stationId && t.kind === 'collection' && t.status !== 'done');
        if (open) {
          next = { ...next, tasks: next.tasks.map((t) => (t.id === open.id ? { ...t, status: 'scheduled', routeId: action.route.id, scheduledFor: action.ts } : t)) };
        } else {
          n++;
          next = {
            ...next,
            tasks: [
              ...next.tasks,
              {
                id: `VC-${String(n).padStart(4, '0')}`,
                stationId: sp.stationId,
                kind: 'collection',
                reason: sp.cls === 'priority' ? 'full' : sp.cls === 'required' ? 'warning' : 'other',
                status: 'scheduled',
                createdAt: action.ts,
                scheduledFor: action.ts,
                assignee: action.route.driver,
                routeId: action.route.id,
              },
            ],
          };
        }
      }
      return next;
    }
    case 'START_ROUTE':
      return mapRoute(state, action.routeId, (r) => (r.status === 'assigned' ? { ...r, status: 'in_progress' } : r));
    case 'SKIP_STOP':
      return mapRoute(state, action.routeId, (r) => ({
        ...r,
        status: r.status === 'assigned' ? 'in_progress' : r.status,
        stops: r.stops.map((sp) => (sp.stationId === action.stationId && sp.status === 'pending' ? { ...sp, status: 'skipped', skipReason: action.reason } : sp)),
      }));
    case 'FINISH_ROUTE': {
      const r = state.routes.find((x) => x.id === action.routeId);
      if (!r || r.status === 'done') return state;
      let next = mapRoute(state, r.id, (x) => ({ ...x, status: 'done', finishedAt: action.ts }));
      const end = r.endAt === 'PARTNER' ? state.settings.partner : state.settings.depot;
      next = { ...next, driverPos: { lat: end.lat, lng: end.lng } };
      // Stops that were skipped go back to the operator as open work orders.
      const skipped = new Set(r.stops.filter((sp) => sp.status !== 'done').map((sp) => sp.stationId));
      next = {
        ...next,
        tasks: next.tasks.map((t) => (t.routeId === r.id && t.status === 'scheduled' && skipped.has(t.stationId) ? { ...t, status: 'open', routeId: undefined } : t)),
      };
      return next;
    }
    case 'CANCEL_ROUTE': {
      const r = state.routes.find((x) => x.id === action.routeId);
      if (!r || r.status === 'done') return state;
      return {
        ...state,
        routes: state.routes.filter((x) => x.id !== r.id),
        tasks: state.tasks.map((t) => (t.routeId === r.id && t.status === 'scheduled' ? { ...t, status: 'open', routeId: undefined } : t)),
      };
    }
    case 'SET_CURRENT_USER':
      return { ...state, currentUserId: action.userId };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'UPDATE_STATION':
      return mapStation(state, action.stationId, (st) => ({ ...st, ...action.patch }));
    case 'SET_ROLE':
      return { ...state, role: action.role, brandView: action.brandView ?? state.brandView };
    case 'SET_LOCATION': {
      if (!Number.isFinite(action.lat) || !Number.isFinite(action.lng)) return state;
      const at = { lat: action.lat, lng: action.lng };
      if (action.target === 'DEPOT') return { ...state, settings: { ...state.settings, depot: { ...state.settings.depot, ...at } } };
      if (action.target === 'PARTNER') return { ...state, settings: { ...state.settings, partner: { ...state.settings.partner, ...at } } };
      return mapStation(state, action.target, (st) => ({ ...st, ...at }));
    }
    case 'SET_DRIVER_POS': {
      const cur = state.driverPos;
      if (cur === action.pos || (cur && action.pos && cur.lat === action.pos.lat && cur.lng === action.pos.lng)) return state;
      return { ...state, driverPos: action.pos };
    }
    case 'RESET_LOCATIONS':
      return placeArea(state, areaById(state.settings.areaId), false);
    case 'APPLY_AREA': {
      const area = AREAS.find((a) => a.id === action.areaId);
      return area ? placeArea(state, area, !!action.keepDriverPos) : state;
    }
    case 'REPLACE_STATE':
      return action.state;
  }
}

/** Every place on the map at an area's illustrative points. The truck goes back to the depot unless kept. */
function placeArea(s: AppState, area: ServiceArea, keepDriverPos: boolean): AppState {
  return {
    ...s,
    stations: s.stations.map((st) => (area.stations[st.id] ? { ...st, ...area.stations[st.id] } : st)),
    settings: {
      ...s.settings,
      areaId: area.id,
      depot: { ...area.depot, name: DEFAULT_SETTINGS.depot.name },
      partner: { ...area.partner, name: DEFAULT_SETTINGS.partner.name },
      zone: { ...area.zone },
    },
    driverPos: keepDriverPos ? s.driverPos : null,
  };
}

function mapRoute(s: AppState, id: string, fn: (r: AssignedRoute) => AssignedRoute): AppState {
  return { ...s, routes: s.routes.map((r) => (r.id === id ? fn(r) : r)) };
}

export function nextTaskId(state: AppState): string {
  const n = state.tasks.reduce((m, t) => Math.max(m, Number(t.id.replace(/\D/g, '')) || 0), 0) + 1;
  return `VC-${String(n).padStart(4, '0')}`;
}

export function nextRouteId(state: AppState): string {
  const n = state.routes.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, '')) || 0), 0) + 1;
  return `TU-${String(n).padStart(4, '0')}`;
}

export function nextBatchId(state: AppState): string {
  const n = state.batches.reduce((m, b) => Math.max(m, Number(b.id.replace(/\D/g, '')) || 0), 0) + 1;
  return `LO-${String(n).padStart(4, '0')}`;
}
