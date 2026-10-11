import type { AppState, Transaction, Batch } from './types';
import { filterTxs, totals, batchEstimatedKg, type TxFilters } from './selectors';
import { toCsv } from './csv';

export const TX_CSV_HEADERS = [
  'transaction_id',
  'timestamp_local',
  'station_id',
  'bin_id',
  'user_id',
  'status',
  'reason',
  'material',
  'brand',
  'barcode_recognized',
  'confidence_pct',
  'measured_g',
  'accepted_mass_g',
  'points',
  'sync',
  'collection_id',
];

export function fmtTs(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function txRow(t: Transaction): unknown[] {
  return [
    t.id,
    fmtTs(t.ts),
    t.stationId,
    t.binId,
    t.userId,
    t.status,
    t.reason ?? '',
    t.material,
    t.brand,
    t.barcodeRecognized ? 'yes' : 'no',
    t.confidencePct,
    t.measuredG,
    t.acceptedMassG,
    t.points,
    t.sync,
    t.collectionId ?? '',
  ];
}

/** The exact rows shown in the filtered transaction table, newest first. */
export function filteredTxRows(state: AppState, f: TxFilters): Transaction[] {
  return filterTxs(state, f).slice().sort((a, b) => b.ts - a.ts);
}

export function transactionsCsv(state: AppState, f: TxFilters): string {
  return toCsv(TX_CSV_HEADERS, filteredTxRows(state, f).map(txRow));
}

export interface BatchSummary {
  batch: Batch;
  estimatedKg: number;
  measuredKg: number | null;
  discrepancyKg: number | null;
  discrepancyPct: number | null;
  confirmedDownstreamKg: number | null;
  stations: string[];
  txCount: number;
  hasRecyclerDocument: boolean;
}

export function summarizeBatch(state: AppState, b: Batch): BatchSummary {
  const cols = state.collections.filter((c) => c.batchId === b.id);
  const estimatedKg = batchEstimatedKg(state, b.id);
  const measuredKg = b.receiving ? b.receiving.measuredKg : null;
  const discrepancyKg = measuredKg === null ? null : measuredKg - estimatedKg;
  return {
    batch: b,
    estimatedKg,
    measuredKg,
    discrepancyKg,
    discrepancyPct: discrepancyKg === null || estimatedKg === 0 ? null : (discrepancyKg / estimatedKg) * 100,
    confirmedDownstreamKg: b.downstream ? b.downstream.confirmedKg : null,
    stations: [...new Set(cols.map((c) => c.stationId))].sort(),
    txCount: cols.reduce((s, c) => s + c.txIds.length, 0),
    hasRecyclerDocument: b.evidence.some((e) => e.kind === 'recycler_document'),
  };
}

export const BATCH_CSV_HEADERS = [
  'batch_id',
  'status',
  'source_stations',
  'linked_transactions',
  'estimated_collected_kg',
  'weighed_receiving_kg',
  'discrepancy_kg',
  'discrepancy_pct',
  'handover_partner',
  'recycler_document_attached',
  'confirmed_downstream_kg',
  'evidence_items',
];

export function batchesCsv(state: AppState): string {
  const rows = state.batches.map((b) => {
    const s = summarizeBatch(state, b);
    return [
      b.id,
      b.status,
      s.stations.join(' '),
      s.txCount,
      s.estimatedKg.toFixed(3),
      s.measuredKg === null ? '' : s.measuredKg.toFixed(3),
      s.discrepancyKg === null ? '' : s.discrepancyKg.toFixed(3),
      s.discrepancyPct === null ? '' : s.discrepancyPct.toFixed(1),
      b.handover?.partner ?? '',
      s.hasRecyclerDocument ? 'yes' : 'no',
      s.confirmedDownstreamKg === null ? '' : s.confirmedDownstreamKg.toFixed(3),
      b.evidence.length,
    ];
  });
  return toCsv(BATCH_CSV_HEADERS, rows);
}

export function reportTotals(state: AppState, f: TxFilters) {
  return totals(filterTxs(state, f));
}
