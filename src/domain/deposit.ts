import type { AppState, ItemInput, Transaction } from './types';
import type { Action } from './reducer';
import { inspectItem, type InspectionResult } from './recognition';
import { canAcceptNext } from './selectors';
import { newId } from './ids';

/** Visible station states, in the order a successful deposit passes through them. */
export const PHASES = [
  'READY',
  'USER_IDENTIFIED',
  'BOTTLE_INSERTED',
  'DOOR_CLOSED',
  'INSPECTING',
  'ACCEPTED',
  'FLATTENING',
  'DROP_CONFIRMED',
  'POINTS_CREDITED',
] as const;
export type Phase = (typeof PHASES)[number] | 'RETURNED' | 'BLOCKED' | 'FAULT' | 'DONE';

export interface SessionInput {
  stationId: string;
  userId: string;
  item: ItemInput;
  quantity: number;
  /** Demo fault injected while flattening bottle number `atBottle` (1-based). */
  inject?: { kind: 'jam' | 'estop'; atBottle: number };
}

export interface Step {
  phase: Phase;
  bottle: number;
  of: number;
  /** Id of the bottle currently in the mechanism, if any. */
  txId?: string;
  actions?: Action[];
  inspection?: InspectionResult;
  blockedWhy?: 'fault' | 'full' | 'capacity' | 'no_user';
  /** Relative duration for the UI animation. */
  weight: number;
}

/**
 * The deposit session as a sequence of steps. The UI animates each step and applies its actions;
 * tests iterate it synchronously. Bottles are processed one at a time, and capacity is re-checked
 * against the latest state before each bottle.
 */
export function* depositSequence(getState: () => AppState, input: SessionInput, now: () => number = Date.now): Generator<Step, void, void> {
  const of = Math.max(1, Math.floor(input.quantity));
  if (!input.userId) {
    yield { phase: 'BLOCKED', bottle: 0, of, blockedWhy: 'no_user', weight: 1 };
    return;
  }
  yield { phase: 'USER_IDENTIFIED', bottle: 0, of, weight: 1 };

  for (let i = 1; i <= of; i++) {
    const state = getState();
    const station = state.stations.find((s) => s.id === input.stationId);
    if (!station) return;
    const pre = canAcceptNext(state, station);
    if (!pre.ok) {
      yield { phase: 'BLOCKED', bottle: i, of, blockedWhy: pre.why, weight: 1 };
      return;
    }
    yield { phase: 'BOTTLE_INSERTED', bottle: i, of, weight: 1 };
    yield { phase: 'DOOR_CLOSED', bottle: i, of, weight: 0.7 };
    const inspection = inspectItem(input.item, state.settings);
    yield { phase: 'INSPECTING', bottle: i, of, inspection, weight: 1.4 };

    const txId = newId(`TX-${station.id}`);
    const base: Transaction = {
      id: txId,
      stationId: station.id,
      binId: station.activeBinId,
      userId: input.userId,
      ts: now(),
      material: inspection.material,
      brand: inspection.brand,
      barcodeRecognized: inspection.barcodeRecognized,
      confidencePct: inspection.confidencePct,
      measuredG: inspection.measuredG,
      acceptedMassG: 0,
      status: 'rejected',
      points: 0,
      sync: 'pending',
    };

    if (inspection.decision === 'return') {
      yield {
        phase: 'RETURNED',
        bottle: i,
        of,
        inspection,
        weight: 1.2,
        actions: [{ type: 'RECORD_ITEM', tx: { ...base, reason: inspection.reason } }],
      };
      continue;
    }

    yield { phase: 'ACCEPTED', bottle: i, of, inspection, txId, weight: 0.8 };
    if (input.inject && input.inject.atBottle === i) {
      yield { phase: 'FLATTENING', bottle: i, of, txId, weight: 1 };
      const ts = now();
      yield {
        phase: 'FAULT',
        bottle: i,
        of,
        txId,
        weight: 1,
        actions: [
          { type: 'SET_FAULT', stationId: station.id, fault: input.inject.kind, ts },
          { type: 'RECORD_ITEM', tx: { ...base, ts, status: 'aborted', reason: input.inject.kind } },
        ],
      };
      return;
    }
    yield { phase: 'FLATTENING', bottle: i, of, txId, weight: 1.6 };
    yield { phase: 'DROP_CONFIRMED', bottle: i, of, txId, weight: 0.8 };
    // Credit happens only here, after drop confirmation, as one idempotent commit.
    const fresh = getState();
    yield {
      phase: 'POINTS_CREDITED',
      bottle: i,
      of,
      txId,
      weight: 0.9,
      actions: [
        {
          type: 'COMMIT_ACCEPTED',
          tx: { ...base, ts: now(), status: 'accepted', acceptedMassG: inspection.acceptedMassG, points: fresh.settings.pointsPerBottle },
        },
      ],
    };
  }
  yield { phase: 'DONE', bottle: of, of, weight: 1 };
}

/** Run a whole session without animation. Used by tests and the "skip animation" path. */
export function runSessionSync(
  getState: () => AppState,
  dispatch: (a: Action) => void,
  input: SessionInput,
  now?: () => number,
): Step[] {
  const steps: Step[] = [];
  for (const step of depositSequence(getState, input, now)) {
    steps.push(step);
    step.actions?.forEach(dispatch);
  }
  return steps;
}
