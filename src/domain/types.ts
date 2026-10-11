// Typed domain model shared by the station simulator, RE Hub, routing, traceability and reporting.
// Every quantity carries its unit in the field name (G = grams, Kg = kilograms, M3 = cubic metres, Pct = percent 0–100).

export type Material = 'PET_CLEAR' | 'PET_COLORED' | 'HDPE' | 'GLASS' | 'METAL_CAN' | 'UNKNOWN_OBJECT';
export const PET_MATERIALS: Material[] = ['PET_CLEAR', 'PET_COLORED'];

/** Illustrative brand codes. 'UNKNOWN' is used whenever the barcode is not in the demo catalog. */
export type BrandId = 'BRAND_A' | 'BRAND_B' | 'BRAND_C' | 'UNKNOWN';

export type FaultKind = 'jam' | 'estop';
export type Connection = 'online' | 'offline';

export interface AccessWindow {
  /** "HH:MM", local time */
  start: string;
  end: string;
}

export interface Station {
  id: string;
  name: string;
  site: string;
  /** Position on the illustrative campus map (0–100 units). Not a real location. */
  mapX: number;
  mapY: number;
  /** Position on the road map. Illustrative, editable in RE Hub settings. */
  lat: number;
  lng: number;
  connection: Connection;
  fault: FaultKind | null;
  activeBinId: string;
  binOpenedAt: number;
  /** Last time the hub received data from this station (epoch ms). */
  lastUpdate: number;
  accessWindow: AccessWindow;
  /** Forecast assumption: accepted bottles per operating hour. */
  forecastRateBph: number;
}

export type TxStatus = 'accepted' | 'rejected' | 'aborted';
export type RejectReason =
  | 'unsupported_material'
  | 'excess_liquid'
  | 'uncertain_identification'
  | 'jam'
  | 'estop';

export interface Transaction {
  id: string;
  stationId: string;
  binId: string;
  userId: string;
  ts: number;
  material: Material;
  brand: BrandId;
  barcodeRecognized: boolean;
  confidencePct: number;
  /** Mass reading on the load cell, grams (includes any liquid). */
  measuredG: number;
  /** Accepted PET mass, grams. Always 0 for rejected or aborted items. */
  acceptedMassG: number;
  status: TxStatus;
  reason?: RejectReason;
  /** Reward points credited. Only non-zero for accepted items after drop confirmation. */
  points: number;
  /** 'pending' = stored on the station only (offline); 'synced' = received by RE Hub. */
  sync: 'pending' | 'synced';
  collectionId?: string;
}

export interface CollectionRecord {
  id: string;
  stationId: string;
  binId: string;
  ts: number;
  driver: string;
  bottleCount: number;
  /** Estimate from station records (sum of accepted mass), kg. */
  estimatedKg: number;
  fillPctAtPickup: number;
  txIds: string[];
  batchId: string;
}

export type EvidenceKind =
  | 'station_log'
  | 'collection_note'
  | 'weigh_ticket'
  | 'handover_note'
  | 'recycler_document';

export interface Evidence {
  id: string;
  kind: EvidenceKind;
  label: string;
  fileName: string;
  ts: number;
  /** 'generated' = produced by this demo; 'attached' = file metadata added by the operator in the demo. */
  origin: 'generated' | 'attached';
  sizeBytes?: number;
}

export type BatchStatus = 'open' | 'received' | 'handed_over';

export interface Batch {
  id: string;
  createdAt: number;
  collectionIds: string[];
  status: BatchStatus;
  receiving?: { measuredKg: number; ts: number; ticketNo: string };
  handover?: { partner: string; ts: number };
  /** Only set by an operator after a recycler document is attached. Never derived automatically. */
  downstream?: { confirmedKg: number; ts: number; note: string };
  evidence: Evidence[];
}

/** A named point on the road map (depot, receiving partner). */
export interface Place {
  lat: number;
  lng: number;
  name: string;
}

export interface Settings {
  pointsPerBottle: number;
  avgBottleMassG: number;
  compactedDensityKgM3: number;
  binVolumeM3: number;
  warnPct: number;
  stopPct: number;
  confidenceThresholdPct: number;
  liquidToleranceG: number;
  /** Where collection trucks start (illustrative). */
  depot: Place;
  /** Where full bins are delivered (illustrative). */
  partner: Place;
  /** Collection area: stations inside it are served by the route. */
  zone: { lat: number; lng: number; radiusKm: number };
}

export interface DemoUser {
  id: string;
  label: string;
}

/** Operator work orders: collection or maintenance requests raised from RE Hub. */
export type WorkKind = 'collection' | 'maintenance';
export type WorkReason = 'full' | 'warning' | 'forecast' | 'jam' | 'estop' | 'offline' | 'other';
export type WorkStatus = 'open' | 'scheduled' | 'done';

export interface WorkOrder {
  id: string;
  stationId: string;
  kind: WorkKind;
  reason: WorkReason;
  status: WorkStatus;
  createdAt: number;
  scheduledFor?: number;
  assignee?: string;
  note?: string;
  routeId?: string;
  resolvedAt?: number;
  resolution?: string;
}

export type StopClassAssigned = 'priority' | 'required' | 'optional';

export interface RouteStop {
  stationId: string;
  cls: StopClassAssigned;
  status: 'pending' | 'done' | 'skipped';
  /** Estimated bin mass from station records at the time the route was planned, kg. */
  estKg: number;
  fillPctAtPlan: number;
  etaMin: number;
  collectionId?: string;
  doneAt?: number;
  skipReason?: string;
}

/** A collection route handed from RE Hub to the driver's phone. */
export interface AssignedRoute {
  id: string;
  createdAt: number;
  departure: string;
  endAt: 'DEPOT' | 'PARTNER';
  driver: string;
  payloadKg: number;
  cargoVolumeM3: number;
  stops: RouteStop[];
  distanceKm: number;
  durationMin: number;
  /** Where distances came from: road routing, a straight-line estimate, or the illustrative matrix. */
  metric?: 'mock' | 'road' | 'estimate';
  status: 'assigned' | 'in_progress' | 'done';
  finishedAt?: number;
}

export interface AppState {
  version: number;
  seededAt: number;
  settings: Settings;
  stations: Station[];
  transactions: Transaction[];
  collections: CollectionRecord[];
  batches: Batch[];
  users: DemoUser[];
  /** Count of duplicate records the hub ignored during sync (demonstrates idempotency). */
  duplicateSyncIgnored: number;
  role: 'operator' | 'brand';
  brandView: Exclude<BrandId, 'UNKNOWN'>;
  log: { ts: number; stationId?: string; text: string; level: 'info' | 'warn' | 'error' }[];
  tasks: WorkOrder[];
  routes: AssignedRoute[];
  /** The demo user signed in to the mobile app. */
  currentUserId: string;
  /** Last known position of the demo truck (null: at the depot). */
  driverPos: { lat: number; lng: number } | null;
}

/** Input describing one item the simulated user puts into the station. */
export interface ItemInput {
  material: Material;
  liquid: 'empty' | 'excess';
  barcode: 'recognized' | 'unknown';
  brand: Exclude<BrandId, 'UNKNOWN'>;
  confidencePct: number;
}
