import type { Settings, Material, BrandId } from './types';

export const STATE_VERSION = 4;
export const STORAGE_KEY = 're-demo-state-v4';

export const DEFAULT_SETTINGS: Settings = {
  pointsPerBottle: 10, // illustrative, editable in demo settings; points have no monetary value
  avgBottleMassG: 22, // proposal assumption, unvalidated
  compactedDensityKgM3: 30, // US EPA lower bound for compacted PET (30–39 kg/m³); RE rollers untested
  binVolumeM3: 0.24,
  warnPct: 80,
  stopPct: 95,
  confidenceThresholdPct: 80,
  liquidToleranceG: 15,
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
