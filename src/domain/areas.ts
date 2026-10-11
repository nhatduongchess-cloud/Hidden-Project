import { haversineM, type LatLng, type Zone } from './geo';

/**
 * Illustrative service areas across Viet Nam. Each one puts the three demo stations on one
 * university campus, with a truck depot and a receiving point in the same city, so the road map,
 * the driver's navigation and route planning can be tried in any of these cities.
 *
 * None of these is a selected pilot site. Points were found with Photon (OpenStreetMap data) and
 * snapped to the nearest road a 2.8 t truck may use with Valhalla's /locate, then checked to have
 * a truck route from the depot to every station and to the receiving point (October 2026).
 * Labels name only the city, never the university, bus station or industrial park underneath.
 */

export const REGIONS = ['Miền Bắc', 'Miền Trung', 'Tây Nguyên', 'Miền Nam'] as const;
export type Region = (typeof REGIONS)[number];

export interface ServiceArea {
  id: string;
  /** City name, as people say it. */
  city: string;
  /** Shorter name for tight spaces (header), when the city name is long. */
  short?: string;
  region: Region;
  zone: Zone;
  depot: LatLng;
  partner: LatLng;
  stations: Record<string, LatLng>;
}

const RADIUS_KM = 2.5;

export const AREAS: ServiceArea[] = [
  {
    id: 'hn',
    city: 'Hà Nội',
    region: 'Miền Bắc',
    zone: { lat: 21.0388, lng: 105.7819, radiusKm: RADIUS_KM },
    depot: { lat: 21.02825, lng: 105.77764 },
    partner: { lat: 21.08105, lng: 105.76129 },
    stations: { 'RE-001': { lat: 21.03841, lng: 105.78046 }, 'RE-002': { lat: 21.04143, lng: 105.78459 }, 'RE-003': { lat: 21.0364, lng: 105.78145 } },
  },
  {
    id: 'hp',
    city: 'Hải Phòng',
    region: 'Miền Bắc',
    zone: { lat: 20.8361, lng: 106.6935, radiusKm: RADIUS_KM },
    depot: { lat: 20.84196, lng: 106.66787 },
    partner: { lat: 20.82702, lng: 106.77464 },
    stations: { 'RE-001': { lat: 20.83578, lng: 106.69201 }, 'RE-002': { lat: 20.8388, lng: 106.69624 }, 'RE-003': { lat: 20.83358, lng: 106.69312 } },
  },
  {
    id: 'vinh',
    city: 'Vinh',
    region: 'Miền Trung',
    zone: { lat: 18.6597, lng: 105.6971, radiusKm: RADIUS_KM },
    depot: { lat: 18.67997, lng: 105.67387 },
    partner: { lat: 18.70722, lng: 105.65389 },
    stations: { 'RE-001': { lat: 18.65937, lng: 105.69578 }, 'RE-002': { lat: 18.6624, lng: 105.69984 }, 'RE-003': { lat: 18.65717, lng: 105.69687 } },
  },
  {
    id: 'hue',
    city: 'Huế',
    region: 'Miền Trung',
    zone: { lat: 16.4679, lng: 107.592, radiusKm: RADIUS_KM },
    depot: { lat: 16.48562, lng: 107.54651 },
    partner: { lat: 16.38756, lng: 107.6939 },
    stations: { 'RE-001': { lat: 16.46742, lng: 107.59065 }, 'RE-002': { lat: 16.47058, lng: 107.59474 }, 'RE-003': { lat: 16.46551, lng: 107.59157 } },
  },
  {
    id: 'dn',
    city: 'Đà Nẵng',
    region: 'Miền Trung',
    zone: { lat: 16.075, lng: 108.1527, radiusKm: RADIUS_KM },
    depot: { lat: 16.05551, lng: 108.1732 },
    partner: { lat: 16.08289, lng: 108.1347 },
    stations: { 'RE-001': { lat: 16.0746, lng: 108.1513 }, 'RE-002': { lat: 16.07789, lng: 108.15554 }, 'RE-003': { lat: 16.07246, lng: 108.15228 } },
  },
  {
    id: 'qn',
    city: 'Quy Nhơn',
    region: 'Miền Trung',
    zone: { lat: 13.7594, lng: 109.2173, radiusKm: RADIUS_KM },
    depot: { lat: 13.75351, lng: 109.20923 },
    partner: { lat: 13.7934, lng: 109.14841 },
    stations: { 'RE-001': { lat: 13.75938, lng: 109.21612 }, 'RE-002': { lat: 13.76216, lng: 109.21986 }, 'RE-003': { lat: 13.75686, lng: 109.21745 } },
  },
  {
    id: 'nt',
    city: 'Nha Trang',
    region: 'Miền Trung',
    zone: { lat: 12.2682, lng: 109.2026, radiusKm: RADIUS_KM },
    depot: { lat: 12.24384, lng: 109.09792 },
    partner: { lat: 12.15032, lng: 109.06716 },
    stations: { 'RE-001': { lat: 12.26781, lng: 109.2011 }, 'RE-002': { lat: 12.27094, lng: 109.20527 }, 'RE-003': { lat: 12.26608, lng: 109.20218 } },
  },
  {
    id: 'dl',
    city: 'Đà Lạt',
    region: 'Tây Nguyên',
    zone: { lat: 11.9561, lng: 108.4454, radiusKm: RADIUS_KM },
    depot: { lat: 11.92675, lng: 108.44565 },
    // Đà Lạt has no industrial park; the nearest is about 30 km away, down the pass.
    partner: { lat: 11.68886, lng: 108.37932 },
    stations: { 'RE-001': { lat: 11.9556, lng: 108.44398 }, 'RE-002': { lat: 11.95892, lng: 108.44788 }, 'RE-003': { lat: 11.95381, lng: 108.4449 } },
  },
  {
    id: 'hcm',
    city: 'TP. Hồ Chí Minh',
    short: 'TP.HCM',
    region: 'Miền Nam',
    // The demo's original points, near Thủ Đức.
    zone: { lat: 10.8778, lng: 106.8018, radiusKm: RADIUS_KM },
    depot: { lat: 10.8494, lng: 106.7738 },
    partner: { lat: 10.8985, lng: 106.765 },
    stations: { 'RE-001': { lat: 10.877, lng: 106.799 }, 'RE-002': { lat: 10.8832, lng: 106.8072 }, 'RE-003': { lat: 10.8728, lng: 106.8012 } },
  },
  {
    id: 'ct',
    city: 'Cần Thơ',
    region: 'Miền Nam',
    zone: { lat: 10.0321, lng: 105.7683, radiusKm: RADIUS_KM },
    depot: { lat: 10.00515, lng: 105.77235 },
    partner: { lat: 10.10944, lng: 105.70599 },
    stations: { 'RE-001': { lat: 10.03167, lng: 105.76685 }, 'RE-002': { lat: 10.03498, lng: 105.77123 }, 'RE-003': { lat: 10.02959, lng: 105.76808 } },
  },
];

export const DEFAULT_AREA_ID = 'hcm';

/** The area with this id; TP.HCM for state saved before areas existed or an unknown id. */
export function areaById(id: string | undefined): ServiceArea {
  return AREAS.find((a) => a.id === id) ?? AREAS.find((a) => a.id === DEFAULT_AREA_ID)!;
}

export function areaLabel(a: ServiceArea): string {
  return a.short ?? a.city;
}

/** The area whose zone centre is closest to `p`, and how far that is. */
export function nearestArea(p: LatLng): { area: ServiceArea; km: number } {
  let best = AREAS[0];
  let bestM = Infinity;
  for (const a of AREAS) {
    const m = haversineM(p, a.zone);
    if (m < bestM) {
      best = a;
      bestM = m;
    }
  }
  return { area: best, km: bestM / 1000 };
}
