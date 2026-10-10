/**
 * Placeholder for a future Supabase adapter. Intentionally not implemented: the prototype has no backend,
 * no credentials and makes no network requests. Do not put keys in this repository.
 *
 * Suggested tables when this is built:
 *   stations(id, name, site, access_window_start, access_window_end, active_bin_id, ...)
 *   transactions(id PK — generated on the station, so retries are idempotent, station_id, bin_id, user_id, ts,
 *                material, brand, barcode_recognized, confidence_pct, measured_g, accepted_mass_g, status, reason, points)
 *   collections(id, station_id, bin_id, ts, driver, estimated_kg, batch_id)
 *   batches(id, status, measured_kg, ticket_no, handover_partner, confirmed_downstream_kg)
 *   evidence(id, batch_id, kind, storage_path, uploaded_by, ts)
 * Row-level security would scope brand users to rows where brand = their brand.
 */
import type { DataRepository } from './types';

export class IntegrationNotConfiguredError extends Error {
  constructor(name: string) {
    super(`${name} is not configured in this prototype.`);
  }
}

export function createSupabaseRepository(): DataRepository {
  throw new IntegrationNotConfiguredError('Supabase');
}
