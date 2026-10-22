import type { AppState, Place } from '../domain/types';
import { planInputs } from '../domain/dispatch';
import { fetchMatrix } from './roadRouting';

export interface FleetVehicle { id: string; driver: string; payloadKg: number; volumeM3: number; start: number; end: number }
export interface FleetStop extends Place { id: string; massKg: number; volumeM3: number; fillPct: number; forecastPct: number; open: number; close: number; cls: string; etaMin: number; status: 'pending' | 'done' }
export interface FleetRoute { vehicle: FleetVehicle; stops: FleetStop[]; distanceKm: number; endMin: number; loadKg: number; volumeM3: number; status: 'assigned' | 'in_progress' | 'done' }
export interface FleetPlan { feasible: boolean; planId?: string; id?: string; createdAt?: number; routes: FleetRoute[]; depot: Place; destination: Place; provider: 'valhalla' | 'osrm' | 'estimate'; unserved: string[]; message: string }
export interface LivePosition { lat: number; lng: number; accuracy: number; heading: number | null; speed: number | null; recordedAt: number; receivedAt: number; tracking: boolean }
export interface FleetSnapshot { revision: number; plan: FleetPlan | null; positions: Record<string, LivePosition>; serverTime: number }
export interface DriverAssignment { route: FleetRoute; depot: Place; destination: Place; position: LivePosition | null; serverTime: number }
export interface DriverLink { vehicleId: string; token: string }
export const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
export const clockTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export class FleetError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function fleetRequest<T>(path: string, key: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: signal ?? AbortSignal.timeout(20000) });
  } catch { throw new FleetError('Không kết nối được dịch vụ đội xe. Kiểm tra mạng và thử lại.', 0); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    throw new FleetError(typeof detail === 'string' ? detail : Array.isArray(detail) ? `Dữ liệu chưa hợp lệ: ${detail[0]?.loc?.slice(1).join(' → ')}. Kiểm tra tải xe, ca và giờ mở cửa.` : 'Dịch vụ đội xe chưa sẵn sàng.', response.status);
  }
  return data as T;
}

export async function optimizeFleet(state: AppState, vehicles: FleetVehicle[], key: string, settings: { serviceMin: number; nextHours: number; includeNearby: boolean; drivingBans: { start: number; end: number }[] }) {
  const matrix = await fetchMatrix([state.settings.depot, ...state.stations, state.settings.partner], [state.settings.depot, ...state.stations, state.settings.partner]);
  const inputs = planInputs(state, settings.nextHours, state.settings.demandMultiplier ?? 1);
  return fleetRequest<FleetPlan>('/optimize', key, {
    vehicles, depot: state.settings.depot, destination: state.settings.partner,
    stations: state.stations.map((s, i) => ({ id: s.id, name: s.name, lat: s.lat, lng: s.lng,
      massKg: inputs[i].massKg, volumeM3: state.settings.binVolumeM3, fillPct: inputs[i].currentPct,
      forecastPct: inputs[i].forecastPct, open: minutes(s.accessWindow.start), close: minutes(s.accessWindow.end) })),
    ...matrix.value, serviceMin: settings.serviceMin, thresholdPct: state.settings.warnPct, stopPct: state.settings.stopPct,
    includeNearby: settings.includeNearby, maxDetourKm: 2, drivingBans: settings.drivingBans,
  });
}

export function driverLink(token: string) { return `${location.origin}${location.pathname}#driver-live-${token}`; }
export function positionState(position: LivePosition | undefined, now = Date.now()) {
  if (!position) return 'Chưa có GPS';
  if (!position.tracking) return 'Đã dừng chia sẻ';
  if (now - position.recordedAt > 30000) return 'Mất tín hiệu';
  return 'Đang cập nhật';
}
