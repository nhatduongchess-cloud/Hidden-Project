import type { Settings, Material, BrandId } from './types';

export const STATE_VERSION = 5;
export const STORAGE_KEY = 're-demo-state-v5';

export const DEFAULT_SETTINGS: Settings = {
  pointsPerBottle: 10, // illustrative, editable in demo settings; points have no monetary value
  avgBottleMassG: 22, // proposal assumption, unvalidated
  compactedDensityKgM3: 30, // US EPA lower bound for compacted PET (30–39 kg/m³); RE rollers untested
  binVolumeM3: 0.24,
  warnPct: 80,
  stopPct: 95,
  confidenceThresholdPct: 80,
  liquidToleranceG: 15,
  // Illustrative locations in Thủ Đức, TP.HCM, chosen only to demonstrate road routing.
  // They are not a selected pilot site and can be moved in RE Hub → Cài đặt.
  depot: { lat: 10.8494, lng: 106.7738, name: 'Bãi xe đội thu gom (minh họa)' },
  partner: { lat: 10.8985, lng: 106.765, name: 'Điểm tiếp nhận (minh họa)' },
  zone: { lat: 10.8778, lng: 106.8018, radiusKm: 2.5 },
};

/** Illustrative road-map positions of the demo stations (see DEFAULT_SETTINGS). */
export const DEFAULT_STATION_LOCATIONS: Record<string, { lat: number; lng: number }> = {
  'RE-001': { lat: 10.877, lng: 106.799 },
  'RE-002': { lat: 10.8832, lng: 106.8072 },
  'RE-003': { lat: 10.8728, lng: 106.8012 },
};

/** Simulated empty-item mass by material (grams). Used to produce a load-cell reading. */
export const ITEM_MASS_G: Record<Material, number> = {
  PET_CLEAR: 22,
  PET_COLORED: 22,
  HDPE: 30,
  GLASS: 240,
  METAL_CAN: 14,
  UNKNOWN_OBJECT: 45,
};
/** Simulated residual liquid for the "excess liquid" case (grams). */
export const EXCESS_LIQUID_G = 140;

export const BRANDS: BrandId[] = ['BRAND_A', 'BRAND_B', 'BRAND_C', 'UNKNOWN'];

export function binCapacityKg(s: Settings): number {
  return s.compactedDensityKgM3 * s.binVolumeM3;
}

export const RECEIVING_PARTNER = 'Đối tác tiếp nhận (minh họa)';

/** Weighed-vs-estimated difference above which a batch is flagged for review (percent). */
export const DISCREPANCY_FLAG_PCT = 5;

/** Illustrative walking distances from the demo user to each station (metres). Not real locations. */
export const DEMO_DISTANCE_M: Record<string, number> = { 'RE-001': 180, 'RE-003': 340, 'RE-002': 620 };
