/**
 * Small geodesy helpers for the road map and turn-by-turn navigation.
 * Distances are metres. Projections are local equirectangular, which is accurate to well under
 * a metre over the few kilometres a collection zone spans.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Zone {
  lat: number;
  lng: number;
  radiusKm: number;
}

const R = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees clockwise from north (0–360). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** Google encoded polyline. Valhalla and OSRM (geometries=polyline6) use precision 6. */
export function decodePolyline(str: string, precision = 6): LatLng[] {
  const factor = 10 ** precision;
  const out: LatLng[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lng += d;
    }
    out.push({ lat: lat / factor, lng: lng / factor });
  }
  return out;
}

export function encodePolyline(pts: LatLng[], precision = 6): string {
  const factor = 10 ** precision;
  let out = '';
  let pLat = 0;
  let pLng = 0;
  const enc = (v: number) => {
    let n = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (n >= 0x20) {
      s += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
      n >>= 5;
    }
    return s + String.fromCharCode(n + 63);
  };
  for (const p of pts) {
    const lat = Math.round(p.lat * factor);
    const lng = Math.round(p.lng * factor);
    out += enc(lat - pLat) + enc(lng - pLng);
    pLat = lat;
    pLng = lng;
  }
  return out;
}

/** Cumulative distance along a polyline, metres; cum[0] = 0. */
export function cumulative(pts: LatLng[]): number[] {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineM(pts[i - 1], pts[i]));
  return cum;
}

export interface Snap {
  /** Segment index: the point lies between pts[index] and pts[index + 1]. */
  index: number;
  /** Distance along the line to the snapped point, metres. */
  along: number;
  /** Perpendicular distance from the input point to the line, metres. */
  offM: number;
  point: LatLng;
}

/**
 * Nearest point on the polyline. `from` limits the search to segments at or after an index,
 * so a vehicle that has passed a junction is not snapped back onto an earlier, overlapping leg.
 */
export function snapToLine(pts: LatLng[], cum: number[], p: LatLng, from = 0, to = pts.length - 1): Snap {
  if (pts.length === 1) return { index: 0, along: 0, offM: haversineM(p, pts[0]), point: pts[0] };
  const kx = Math.cos(rad(p.lat)) * ((Math.PI * R) / 180);
  const ky = (Math.PI * R) / 180;
  let best: Snap = { index: 0, along: 0, offM: Infinity, point: pts[0] };
  const end = Math.min(to, pts.length - 1);
  for (let i = Math.max(0, from); i < end; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ax = (a.lng - p.lng) * kx;
    const ay = (a.lat - p.lat) * ky;
    const bx = (b.lng - p.lng) * kx;
    const by = (b.lat - p.lat) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const x = ax + t * dx;
    const y = ay + t * dy;
    const off = Math.hypot(x, y);
    if (off < best.offM) {
      best = {
        index: i,
        along: cum[i] + t * (cum[i + 1] - cum[i]),
        offM: off,
        point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) },
      };
    }
  }
  return best;
}

/** Point at a distance along the polyline, with the heading of the segment it lies on. */
export function pointAlong(pts: LatLng[], cum: number[], d: number): { point: LatLng; index: number; heading: number } {
  const total = cum[cum.length - 1] ?? 0;
  if (pts.length < 2) return { point: pts[0], index: 0, heading: 0 };
  const dd = Math.max(0, Math.min(total, d));
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= dd) lo = mid;
    else hi = mid;
  }
  const seg = cum[hi] - cum[lo];
  const t = seg > 0 ? (dd - cum[lo]) / seg : 0;
  const a = pts[lo];
  const b = pts[hi];
  return { point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) }, index: lo, heading: bearingDeg(a, b) };
}

export function inZone(p: LatLng, z: Zone): boolean {
  return haversineM(p, z) <= z.radiusKm * 1000;
}

/** "350 m", "1,2 km": rounded the way a navigation banner reads. */
export function fmtDistanceVi(m: number): string {
  if (!Number.isFinite(m)) return '—';
  const step = m < 100 ? 10 : 50;
  const rounded = Math.max(10, Math.round(m / step) * step);
  // 980 m rounds to 1000 m, which reads as "1,0 km".
  if (rounded < 1000) return `${rounded} m`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0).replace('.', ',')} km`;
}

/** "7 phút", "1 giờ 05 phút". */
export function fmtDurationVi(s: number): string {
  if (!Number.isFinite(s)) return '—';
  const min = Math.max(1, Math.round(s / 60));
  if (min < 60) return `${min} phút`;
  return `${Math.floor(min / 60)} giờ ${String(min % 60).padStart(2, '0')} phút`;
}
