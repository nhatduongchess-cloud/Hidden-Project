import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ItemInput, Transaction } from '../../domain/types';
import { depositSequence, type Phase, type Step } from '../../domain/deposit';
import type { InspectionResult } from '../../domain/recognition';
import type { Store } from '../../domain/store';
import { useStore } from '../../lib/store-context';

/** What the demo panel controls. Kept apart from consumer UI state on purpose. */
export interface DemoConfig {
  item: ItemInput;
  injectNext: 'none' | 'jam';
  speed: 'normal' | 'fast';
}

export const DEFAULT_ITEM: ItemInput = { material: 'PET_CLEAR', liquid: 'empty', barcode: 'recognized', brand: 'BRAND_A', confidencePct: 92 };

export interface LiveEvent {
  ts: number;
  text: string;
  tone: 'info' | 'ok' | 'warn' | 'stop';
}

export interface RunState {
  running: boolean;
  phase: Phase | 'IDLE';
  inspection: InspectionResult | null;
  txId: string | null;
  blockedWhy: Step['blockedWhy'] | null;
  credited: Transaction | null;
  events: LiveEvent[];
}

const IDLE: RunState = { running: false, phase: 'IDLE', inspection: null, txId: null, blockedWhy: null, credited: null, events: [] };

function reducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const REASON_LOG: Record<string, string> = {
  unsupported_material: 'Trả lại: vật liệu không phải PET',
  excess_liquid: 'Trả lại: còn chất lỏng',
  uncertain_identification: 'Trả lại: nhận diện không chắc chắn',
};

/**
 * Runs one bottle through the station at a time. All state changes go through the shared store,
 * so the app, RE Hub and reports read the same records. Points are credited only by the commit
 * that follows drop confirmation.
 */
function useBottleRun(store: Store) {
  const [rs, setRs] = useState<RunState>(IDLE);
  const abort = useRef(false);
  const current = useRef<{ step: Step; stationId: string; userId: string; item: ItemInput } | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abort.current = true;
    };
  }, []);

  const log = (text: string, tone: LiveEvent['tone'] = 'info') => setRs((s) => ({ ...s, events: [{ ts: Date.now(), text, tone }, ...s.events].slice(0, 40) }));

  const run = useCallback(
    async (stationId: string, userId: string, cfg: DemoConfig) => {
      if (current.current) return;
      abort.current = false;
      const base = reducedMotion() ? 90 : cfg.speed === 'fast' ? 220 : 700;
      setRs((s) => ({ ...s, running: true, phase: 'BOTTLE_INSERTED', inspection: null, txId: null, blockedWhy: null, credited: null }));
      const input = { stationId, userId, item: cfg.item, quantity: 1, inject: cfg.injectNext === 'jam' ? { kind: 'jam' as const, atBottle: 1 } : undefined };
      for (const step of depositSequence(store.getState, input)) {
        if (abort.current || !alive.current) break;
        if (step.phase === 'USER_IDENTIFIED' || step.phase === 'DONE') continue;
        current.current = { step, stationId, userId, item: cfg.item };
        step.actions?.forEach((a) => store.dispatch(a));
        const credited = step.phase === 'POINTS_CREDITED' ? (store.getState().transactions.find((t) => t.id === step.txId) ?? null) : null;
        setRs((s) => ({
          ...s,
          phase: step.phase,
          inspection: step.inspection ?? s.inspection,
          txId: step.txId ?? s.txId,
          blockedWhy: step.blockedWhy ?? null,
          credited: credited ?? s.credited,
        }));
        switch (step.phase) {
          case 'BOTTLE_INSERTED':
            log('Cảm biến khe: có vật phẩm');
            break;
          case 'DOOR_CLOSED':
            log('Cửa ngoài đã đóng, khóa liên động OK');
            break;
          case 'INSPECTING':
            if (step.inspection) {
              log(`Camera: ${step.inspection.signals.camera}`);
              log(`Mã vạch: ${step.inspection.barcodeRecognized ? 'có trong danh mục' : 'không đọc được'}`);
              log(`Cân: ${step.inspection.signals.weight}`);
            }
            break;
          case 'RETURNED':
            log(REASON_LOG[step.inspection?.reason ?? ''] ?? 'Trả lại', 'warn');
            break;
          case 'ACCEPTED':
            log('Hợp lệ: mở sàn rơi', 'ok');
            break;
          case 'FLATTENING':
            log('Rulo quay: cán dẹt chai');
            break;
          case 'DROP_CONFIRMED':
            log('Cảm biến rơi: chai đã vào thùng', 'ok');
            break;
          case 'POINTS_CREDITED':
            log(credited?.sync === 'pending' ? `Ghi +${credited.points} điểm, chờ đồng bộ` : `Cộng +${credited?.points ?? 0} điểm`, 'ok');
            break;
          case 'FAULT':
            log('Kẹt rulo: trạm dừng xử lý, chai không được tính điểm', 'stop');
            break;
          case 'BLOCKED':
            log(step.blockedWhy === 'fault' ? 'Trạm đang lỗi, không nhận chai' : 'Thùng đã đạt ngưỡng dừng, không nhận chai', 'stop');
            break;
        }
        await new Promise((r) => setTimeout(r, base * step.weight));
      }
      current.current = null;
      if (alive.current) setRs((s) => ({ ...s, running: false }));
    },
    [store],
  );

  /** Emergency stop from the station: halts processing; an item inside the mechanism is recorded as aborted. */
  const emergencyStop = useCallback(
    (stationId: string) => {
      const c = current.current;
      abort.current = true;
      const ts = Date.now();
      store.dispatch({ type: 'SET_FAULT', stationId, fault: 'estop', ts });
      if (c && c.stationId === stationId && c.step.txId && ['ACCEPTED', 'FLATTENING', 'DROP_CONFIRMED'].includes(c.step.phase)) {
        const st = store.getState().stations.find((x) => x.id === stationId)!;
        store.dispatch({
          type: 'RECORD_ITEM',
          tx: {
            id: c.step.txId,
            stationId,
            binId: st.activeBinId,
            userId: c.userId,
            ts,
            material: c.item.material,
            brand: c.step.inspection?.brand ?? 'UNKNOWN',
            barcodeRecognized: c.item.barcode === 'recognized',
            confidencePct: c.item.confidencePct,
            measuredG: c.step.inspection?.measuredG ?? 0,
            acceptedMassG: 0,
            status: 'aborted',
            reason: 'estop',
            points: 0,
            sync: 'pending',
          },
        });
      }
      current.current = null;
      setRs((s) => ({ ...s, running: false, phase: 'FAULT', events: [{ ts, text: 'Nút dừng khẩn cấp được nhấn', tone: 'stop' as const }, ...s.events] }));
    },
    [store],
  );

  const reset = useCallback(() => setRs((s) => ({ ...IDLE, events: s.events })), []);
  return { rs, run, emergencyStop, reset, log };
}

interface Ctx {
  cfg: DemoConfig;
  setCfg: (p: Partial<DemoConfig>) => void;
  stationId: string;
  setStationId: (id: string) => void;
  run: ReturnType<typeof useBottleRun>;
  /** Flow step shown in the app, owned by the return flow but readable by the demo panel. */
  flowStep: string;
  setFlowStep: (s: string) => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppDemoProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [cfg, setCfgState] = useState<DemoConfig>({ item: DEFAULT_ITEM, injectNext: 'none', speed: 'normal' });
  const [stationId, setStationId] = useState('RE-001');
  const [flowStep, setFlowStep] = useState('choose');
  const run = useBottleRun(store);
  const setCfg = useCallback((p: Partial<DemoConfig>) => setCfgState((c) => ({ ...c, ...p })), []);
  const value = useMemo(() => ({ cfg, setCfg, stationId, setStationId, run, flowStep, setFlowStep }), [cfg, setCfg, stationId, run, flowStep]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppDemo(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('AppDemoProvider missing');
  return c;
}
