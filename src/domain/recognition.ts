import type { ItemInput, Material, RejectReason, Settings, BrandId } from './types';
import { PET_MATERIALS } from './types';
import { ITEM_MASS_G, EXCESS_LIQUID_G } from './constants';

/**
 * Simulated recognition. A real station would fuse a camera classifier, a barcode reader and a load cell.
 * A camera alone cannot guarantee polymer identification, so the decision always combines all three signals.
 */
export interface InspectionResult {
  decision: 'accept' | 'return';
  reason?: RejectReason;
  material: Material;
  brand: BrandId;
  measuredG: number;
  acceptedMassG: number;
  confidencePct: number;
  barcodeRecognized: boolean;
  signals: { camera: string; barcode: string; weight: string };
}

/** Confidence margin granted when a catalogued barcode corroborates the camera. */
export const BARCODE_CORROBORATION_PCT = 20;

export function inspectItem(item: ItemInput, settings: Settings): InspectionResult {
  const isPet = PET_MATERIALS.includes(item.material);
  const barcodeRecognized = item.barcode === 'recognized';
  const measuredG = ITEM_MASS_G[item.material] + (item.liquid === 'excess' ? EXCESS_LIQUID_G : 0);
  const petMax = settings.avgBottleMassG + settings.liquidToleranceG;
  const conf = Math.max(0, Math.min(100, item.confidencePct));
  const requiredConf = barcodeRecognized
    ? settings.confidenceThresholdPct - BARCODE_CORROBORATION_PCT
    : settings.confidenceThresholdPct;

  const base = {
    material: item.material,
    brand: (barcodeRecognized ? item.brand : 'UNKNOWN') as BrandId,
    measuredG,
    confidencePct: conf,
    barcodeRecognized,
    signals: {
      camera: `${item.material} · ${conf}%`,
      barcode: barcodeRecognized ? 'catalog' : 'unknown',
      weight: `${measuredG} g / ≤ ${petMax} g`,
    },
  };
  const ret = (reason: RejectReason): InspectionResult => ({ ...base, decision: 'return', reason, acceptedMassG: 0 });

  // 1. Material: non-PET is returned when either the camera is confident or the barcode identifies it.
  if (!isPet) {
    if (conf >= settings.confidenceThresholdPct || barcodeRecognized) return ret('unsupported_material');
    return ret('uncertain_identification');
  }
  // 2. Weight window: heavier than an empty PET bottle means residual liquid.
  if (measuredG > petMax) return ret('excess_liquid');
  // 3. Confidence: without a catalogued barcode the camera must clear the full threshold.
  if (conf < requiredConf) return ret('uncertain_identification');

  return { ...base, decision: 'accept', acceptedMassG: settings.avgBottleMassG };
}
