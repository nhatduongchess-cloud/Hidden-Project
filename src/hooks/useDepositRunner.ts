import { useCallback, useEffect, useRef, useState } from 'react';
import type { Store } from '../domain/store';
import { depositSequence, type Phase, type SessionInput, type Step } from '../domain/deposit';
import type { InspectionResult } from '../domain/recognition';

export interface BottleResult {
  bottle: number;
  outcome: 'accepted' | 'returned' | 'fault' | 'blocked';
  reason?: string;
  points: number;
  sync?: 'pending' | 'synced';
}

export interface RunnerState {
  running: boolean;
  phase: Phase;
  bottle: number;
  of: number;
  inspection: InspectionResult | null;
  pointsShown: number | null;
  blockedWhy: Step['blockedWhy'] | null;
  results: BottleResult[];
  stationId: string | null;
}

const IDLE: RunnerState = { running: false, phase: 'READY', bottle: 0, of: 0, inspection: null, pointsShown: null, blockedWhy: null, results: [], stationId: null };

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Animates a deposit session step by step. All state changes go through the shared store, so
 * the simulator, RE Hub and reports read the same data. Points are credited only by the
 * POINTS_CREDITED step's commit, which happens after drop confirmation.
 */
export function useDepositRunner(store: Store) {
  const [rs, setRs] = useState<RunnerState>(IDLE);
  const abort = useRef(false);
  const current = useRef<Step | null>(null);
  const session = useRef<SessionInput | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current = true;
    };
  }, []);

  const start = useCallback(
    async (input: SessionInput, speed: 'normal' | 'fast') => {
      if (rs.running) return;
      abort.current = false;
      session.current = input;
      const base = prefersReducedMotion() ? 60 : speed === 'fast' ? 170 : 620;
      setRs({ ...IDLE, running: true, of: input.quantity, stationId: input.stationId });
      const results: BottleResult[] = [];
      for (const step of depositSequence(store.getState, input)) {
        if (abort.current || !alive.current) break;
        current.current = step;
        step.actions?.forEach((a) => store.dispatch(a));
        if (step.phase === 'RETURNED') results.push({ bottle: step.bottle, outcome: 'returned', reason: step.inspection?.reason, points: 0 });
        if (step.phase === 'POINTS_CREDITED') {
          const tx = store.getState().transactions.find((t) => t.id === step.txId);
          if (tx) results.push({ bottle: step.bottle, outcome: 'accepted', points: tx.points, sync: tx.sync });
          else results.push({ bottle: step.bottle, outcome: 'fault', reason: 'estop', points: 0 });
        }
        if (step.phase === 'FAULT') results.push({ bottle: step.bottle, outcome: 'fault', reason: session.current?.inject?.kind, points: 0 });
        if (step.phase === 'BLOCKED') results.push({ bottle: step.bottle, outcome: 'blocked', reason: step.blockedWhy, points: 0 });
        setRs((s) => ({
          ...s,
          phase: step.phase,
          bottle: step.bottle,
          of: step.of,
          inspection: step.inspection ?? (step.phase === 'BOTTLE_INSERTED' ? null : s.inspection),
          pointsShown: step.phase === 'POINTS_CREDITED' ? (results.at(-1)?.points ?? null) : step.phase === 'BOTTLE_INSERTED' ? null : s.pointsShown,
          blockedWhy: step.blockedWhy ?? null,
          results: [...results],
        }));
        await new Promise((r) => setTimeout(r, base * step.weight));
      }
      current.current = null;
      if (alive.current) setRs((s) => ({ ...s, running: false }));
    },
    [rs.running, store],
  );

  /** Emergency stop: halts the session; a bottle inside the mechanism is recorded as aborted, never credited. */
  const emergencyStop = useCallback(
    (stationId: string) => {
      const step = current.current;
      const s = session.current;
      abort.current = true;
      const ts = Date.now();
      store.dispatch({ type: 'SET_FAULT', stationId, fault: 'estop', ts });
      if (step?.txId && s && s.stationId === stationId && ['ACCEPTED', 'FLATTENING', 'DROP_CONFIRMED'].includes(step.phase)) {
        const st = store.getState().stations.find((x) => x.id === stationId)!;
        store.dispatch({
          type: 'RECORD_ITEM',
          tx: {
            id: step.txId,
            stationId,
            binId: st.activeBinId,
            userId: s.userId,
            ts,
            material: s.item.material,
            brand: step.inspection?.brand ?? 'UNKNOWN',
            barcodeRecognized: s.item.barcode === 'recognized',
            confidencePct: s.item.confidencePct,
            measuredG: step.inspection?.measuredG ?? 0,
            acceptedMassG: 0,
            status: 'aborted',
            reason: 'estop',
            points: 0,
            sync: 'pending',
          },
        });
      }
      setRs((r) => ({
        ...r,
        running: false,
        phase: 'FAULT',
        results: step?.txId && r.running ? [...r.results, { bottle: step.bottle, outcome: 'fault', reason: 'estop', points: 0 }] : r.results,
      }));
    },
    [store],
  );

  const resetView = useCallback(() => setRs(IDLE), []);

  return { rs, start, emergencyStop, resetView };
}
