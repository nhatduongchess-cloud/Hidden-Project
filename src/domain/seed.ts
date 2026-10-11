import type { AppState, Station, Transaction, CollectionRecord, Batch, Material, BrandId, RejectReason, Evidence, WorkOrder } from './types';
import { DEFAULT_SETTINGS, DEFAULT_STATION_LOCATIONS, STATE_VERSION, binCapacityKg, RECEIVING_PARTNER } from './constants';

/**
 * Fictional seed data for the demo. Nothing here is an operating statistic: the pilot has not run.
 * The generator is deterministic for a given `now` so tests are repeatable.
 */
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
/** RE-002 lost its 4G link shortly before the demo starts, so RE Hub shows its last reading as stale. */
export const OFFLINE_STATION = 'RE-002';
export const OFFLINE_FOR_MIN = 26;
const DAY = 24 * HOUR;

interface StationSeed {
  id: string;
  name: string;
  site: string;
  mapX: number;
  mapY: number;
  targetFillPct: number;
  rate: number;
  window: [string, string];
  /** bottles in each previously collected bin, oldest first */
  pastBins: number[];
}

const SEEDS: StationSeed[] = [
  { id: 'RE-001', name: 'Sảnh nhà học A', site: 'Khu giảng đường', mapX: 30, mapY: 38, targetFillPct: 56, rate: 8, window: ['07:00', '21:00'], pastBins: [268, 281, 274] },
  { id: 'RE-002', name: 'Ký túc xá B', site: 'Khu ký túc xá', mapX: 72, mapY: 24, targetFillPct: 81, rate: 17, window: ['06:00', '22:00'], pastBins: [276, 290, 283] },
  { id: 'RE-003', name: 'Thư viện trung tâm', site: 'Khu thư viện', mapX: 46, mapY: 66, targetFillPct: 96, rate: 11, window: ['07:30', '17:00'], pastBins: [262, 271, 266] },
];

const USERS = [
  { id: 'SV-DEMO-01', label: 'Sinh viên demo 01' },
  { id: 'SV-DEMO-02', label: 'Sinh viên demo 02' },
  { id: 'SV-DEMO-03', label: 'Sinh viên demo 03' },
  { id: 'NV-DEMO-01', label: 'Nhân viên demo 01' },
  { id: 'SV-DEMO-04', label: 'Sinh viên demo 04' },
];

function pickMaterial(r: number): Material {
  return r < 0.7 ? 'PET_CLEAR' : 'PET_COLORED';
}
function pickBrand(r: number): BrandId {
  return r < 0.3 ? 'BRAND_A' : r < 0.55 ? 'BRAND_B' : r < 0.7 ? 'BRAND_C' : 'UNKNOWN';
}
function pickReject(r: number): { reason: RejectReason; material: Material; measuredG: number } {
  if (r < 0.45) return { reason: 'excess_liquid', material: 'PET_CLEAR', measuredG: 162 };
  if (r < 0.7) return { reason: 'unsupported_material', material: 'HDPE', measuredG: 30 };
  if (r < 0.82) return { reason: 'unsupported_material', material: 'METAL_CAN', measuredG: 14 };
  return { reason: 'uncertain_identification', material: 'PET_COLORED', measuredG: 22 };
}

/** Spread `n` timestamps between `from` and `to`, only inside operating hours 07–21. */
function spread(rand: () => number, n: number, from: number, to: number): number[] {
  const out: number[] = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 50) {
    const t = from + rand() * (to - from);
    const h = new Date(t).getHours();
    if (h >= 7 && h < 21) out.push(Math.round(t));
  }
  while (out.length < n) out.push(to - out.length * 1000);
  return out.sort((a, b) => a - b);
}

export function createSeedState(now: number = Date.now()): AppState {
  const rand = mulberry32(20261010);
  const settings = { ...DEFAULT_SETTINGS };
  const capG = binCapacityKg(settings) * 1000;
  const transactions: Transaction[] = [];
  const collections: CollectionRecord[] = [];
  const stations: Station[] = [];
  let txN = 0;

  const makeTxs = (st: StationSeed, binId: string, accepted: number, from: number, to: number) => {
    const rejects = Math.round(accepted * 0.07);
    const times = spread(rand, accepted + rejects, from, to);
    const order = times.map((ts, i) => ({ ts, rejected: i % Math.max(1, Math.round((accepted + rejects) / Math.max(1, rejects))) === 3 && rejects > 0 }));
    let accLeft = accepted;
    let rejLeft = rejects;
    const ids: string[] = [];
    for (const o of order) {
      const isRej = (o.rejected && rejLeft > 0) || accLeft === 0;
      const user = USERS[Math.floor(rand() * USERS.length)].id;
      const id = `TX-${st.id}-S${String(++txN).padStart(5, '0')}`;
      if (isRej) {
        rejLeft--;
        const r = pickReject(rand());
        transactions.push({
          id, stationId: st.id, binId, userId: user, ts: o.ts, material: r.material, brand: 'UNKNOWN',
          barcodeRecognized: false, confidencePct: Math.round(55 + rand() * 40), measuredG: r.measuredG,
          acceptedMassG: 0, status: 'rejected', reason: r.reason, points: 0, sync: 'synced',
        });
      } else {
        accLeft--;
        const brand = pickBrand(rand());
        transactions.push({
          id, stationId: st.id, binId, userId: user, ts: o.ts, material: pickMaterial(rand()), brand,
          barcodeRecognized: brand !== 'UNKNOWN', confidencePct: Math.round(84 + rand() * 15),
          measuredG: settings.avgBottleMassG, acceptedMassG: settings.avgBottleMassG, status: 'accepted',
          points: settings.pointsPerBottle, sync: 'synced',
        });
        ids.push(id);
      }
    }
    return ids;
  };

  // Past batches: LO-0001 weighed and handed over (no recycler document yet), LO-0002 weighed with a
  // discrepancy to review, LO-0003 collected but not yet weighed.
  const batches: Batch[] = [
    { id: 'LO-0001', createdAt: 0, collectionIds: [], status: 'handed_over', evidence: [] },
    { id: 'LO-0002', createdAt: 0, collectionIds: [], status: 'received', evidence: [] },
    { id: 'LO-0003', createdAt: 0, collectionIds: [], status: 'open', evidence: [] },
  ];

  SEEDS.forEach((st, sIdx) => {
    // Bin timeline: past bins over the last ~10 days, then the active bin.
    let cursor = now - (15 - sIdx * 0.4) * DAY;
    st.pastBins.forEach((count, bIdx) => {
      const binId = `${st.id}-BIN-H${bIdx + 1}`;
      const dur = (count / st.rate) * HOUR * 1.9;
      const end = cursor + dur;
      const ids = makeTxs(st, binId, count, cursor, end);
      const batch = batches[bIdx];
      const colId = `TG-${st.id}-H${bIdx + 1}`;
      const pickupTs = end + 2 * HOUR;
      collections.push({
        id: colId, stationId: st.id, binId, ts: pickupTs, driver: 'Tài xế demo', bottleCount: count,
        estimatedKg: (count * settings.avgBottleMassG) / 1000, fillPctAtPickup: ((count * settings.avgBottleMassG) / capG) * 100,
        txIds: ids, batchId: batch.id,
      });
      batch.collectionIds.push(colId);
      for (const t of transactions) if (t.binId === binId && t.status === 'accepted') t.collectionId = colId;
      cursor = pickupTs;
    });
    const activeCount = Math.round(((st.targetFillPct / 100) * capG) / settings.avgBottleMassG);
    const binId = `${st.id}-BIN-A1`;
    const openedAt = Math.min(cursor, now - (activeCount / st.rate) * HOUR * 1.6);
    makeTxs(st, binId, activeCount, openedAt, now - 30 * 60_000);
    const offline = st.id === OFFLINE_STATION;
    stations.push({
      id: st.id, name: st.name, site: st.site, mapX: st.mapX, mapY: st.mapY, ...DEFAULT_STATION_LOCATIONS[st.id], connection: offline ? 'offline' : 'online', fault: null,
      activeBinId: binId, binOpenedAt: openedAt, lastUpdate: offline ? now - OFFLINE_FOR_MIN * 60_000 : now - (2 + sIdx * 3) * 60_000,
      accessWindow: { start: st.window[0], end: st.window[1] }, forecastRateBph: st.rate,
    });
    if (offline) {
      // Deposits made after the connection dropped are kept on the station and wait for sync.
      const pendingUsers = ['SV-DEMO-01', 'SV-DEMO-03', 'SV-DEMO-01', 'SV-DEMO-02', 'NV-DEMO-01'];
      pendingUsers.forEach((u, i) => {
        const brand = pickBrand(rand());
        transactions.push({
          id: `TX-${st.id}-S${String(++txN).padStart(5, '0')}`, stationId: st.id, binId, userId: u,
          ts: now - (OFFLINE_FOR_MIN - 4 - i * 4) * 60_000, material: 'PET_CLEAR', brand, barcodeRecognized: brand !== 'UNKNOWN',
          confidencePct: 91, measuredG: settings.avgBottleMassG, acceptedMassG: settings.avgBottleMassG, status: 'accepted',
          points: settings.pointsPerBottle, sync: 'pending',
        });
      });
    }
  });

  // Generated documentation for seeded batches (demo data, not real documents).
  const gen = (kind: Evidence['kind'], label: string, fileName: string, ts: number): Evidence => ({
    id: `EV-${fileName}`, kind, label, fileName, ts, origin: 'generated',
  });
  for (const b of batches) {
    const cols = collections.filter((c) => c.batchId === b.id);
    const firstTs = Math.min(...cols.map((c) => c.ts));
    b.createdAt = firstTs;
    b.evidence.push(gen('station_log', `station_log:${cols.length}`, `${b.id}-nhat-ky-tram.csv`, firstTs));
    for (const c of cols) b.evidence.push(gen('collection_note', `collection:${c.stationId}:${c.bottleCount}`, `${c.id}.json`, c.ts));
  }
  const receive = (b: Batch, ratio: number, ticketNo: string) => {
    const est = collections.filter((c) => c.batchId === b.id).reduce((s, c) => s + c.estimatedKg, 0);
    const lastCol = Math.max(...collections.filter((c) => c.batchId === b.id).map((c) => c.ts));
    b.receiving = { measuredKg: Math.round(est * ratio * 10) / 10, ts: Math.min(now - HOUR, lastCol + 5 * HOUR), ticketNo };
    b.evidence.push(gen('weigh_ticket', ticketNo, `${ticketNo}.pdf`, b.receiving.ts));
  };
  const [b1, b2] = batches;
  receive(b1, 0.962, 'PC-DEMO-0001');
  b1.handover = { partner: RECEIVING_PARTNER, ts: b1.receiving!.ts + 20 * HOUR };
  b1.evidence.push(gen('handover_note', RECEIVING_PARTNER, 'BG-LO-0001.pdf', b1.handover.ts));
  // LO-0002: weighed lighter than the station estimate, so RE Hub flags it for review.
  receive(b2, 0.913, 'PC-DEMO-0002');

  const tasks: WorkOrder[] = [
    {
      id: 'VC-0001', stationId: 'RE-001', kind: 'maintenance', reason: 'jam', status: 'done',
      createdAt: now - 3 * DAY - 2 * HOUR, scheduledFor: now - 3 * DAY - HOUR, assignee: 'Kỹ thuật viên demo',
      note: 'Kẹt rulo khi nhận chai 1,5 lít còn nắp', resolvedAt: now - 3 * DAY, resolution: 'Gỡ kẹt, kiểm tra khóa liên động',
    },
  ];

  transactions.sort((a, b) => a.ts - b.ts);

  return {
    version: STATE_VERSION,
    seededAt: now,
    settings,
    stations,
    transactions,
    collections,
    batches,
    users: USERS,
    duplicateSyncIgnored: 0,
    role: 'operator',
    brandView: 'BRAND_A',
    log: [
      { ts: now - OFFLINE_FOR_MIN * 60_000, stationId: OFFLINE_STATION, level: 'warn', text: 'conn_offline' },
      { ts: now - 40 * 60_000, stationId: 'RE-003', level: 'error', text: 'stop_reached' },
      { ts: now - 2 * HOUR, stationId: 'RE-002', level: 'warn', text: 'warn_crossed' },
      { ts: now - 3 * DAY, stationId: 'RE-001', level: 'info', text: 'cleared_jam' },
      { ts: now - 3 * DAY - 2 * HOUR, stationId: 'RE-001', level: 'error', text: 'fault_jam' },
    ],
    tasks,
    routes: [],
    currentUserId: 'SV-DEMO-01',
    driverPos: null,
  };
}
