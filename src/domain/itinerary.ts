import type { AppState, AssignedRoute } from './types';
import { fmtMin } from './routing';

/** Portable text for the driver's messaging app; it never claims cross-device synchronization. */
export function driverItinerary(state: AppState, route: AssignedRoute): string {
  const end = route.endAt === 'PARTNER' ? state.settings.partner : state.settings.depot;
  return [
    `RE · LỘ TRÌNH ${route.id} (MINH HỌA)`,
    `${route.driver} · Xuất phát ${route.departure}`,
    `Tải trọng ${route.payloadKg} kg · ${route.distanceKm.toFixed(1)} km dự kiến`,
    '',
    ...route.stops.map((stop, i) => {
      const station = state.stations.find((s) => s.id === stop.stationId);
      return `${i + 1}. ${stop.stationId} · ${station?.name ?? ''}\nDự kiến ${fmtMin(stop.etaMin)} · mức đầy ${Math.round(stop.fillPctAtPlan)}% · ${stop.estKg.toFixed(2)} kg\n${station ? `https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=18/${station.lat}/${station.lng}` : ''}`;
    }),
    '',
    `Điểm cuối: ${end.name}`,
    `https://www.openstreetmap.org/?mlat=${end.lat}&mlon=${end.lng}#map=18/${end.lat}/${end.lng}`,
    '',
    'Thay thùng đầy bằng thùng rỗng tại từng trạm. Kiểm tra khung giờ vào trạm và quy định lưu thông trước khi chạy.',
    'Bản chia sẻ để tham khảo; không đồng bộ xác nhận thay thùng giữa các thiết bị.',
  ].join('\n');
}
