import type { Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import { encodePolyline, haversineM, type LatLng } from '../src/domain/geo';

/**
 * Stand-ins for the public map services, so browser tests are deterministic and never call the
 * real servers. Routes follow an L-shaped "street" between consecutive points (east–west first,
 * then north–south), with a turn at the corner, at 25 km/h.
 */

const KMH = 25;

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/** A plain 256 × 256 tile with a faint grid, so the map has a ground. */
function tilePng(): Buffer {
  const w = 256;
  const rows: Buffer[] = [];
  for (let y = 0; y < w; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      const line = x % 64 === 0 || y % 64 === 0;
      const v = line ? [222, 224, 218] : [236, 238, 233];
      row.set(v, 1 + x * 3);
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(w, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const TILE = tilePng();

/** Points every ~40 m from a to b. */
function densify(a: LatLng, b: LatLng): LatLng[] {
  const n = Math.max(1, Math.ceil(haversineM(a, b) / 40));
  return Array.from({ length: n + 1 }, (_, i) => ({ lat: a.lat + ((b.lat - a.lat) * i) / n, lng: a.lng + ((b.lng - a.lng) * i) / n }));
}

interface Leg {
  shape: LatLng[];
  corner: number;
  turn: 'left' | 'right' | 'straight';
  firstM: number;
  secondM: number;
}
function leg(a: LatLng, b: LatLng): Leg {
  const c = { lat: a.lat, lng: b.lng };
  const first = densify(a, c);
  const second = densify(c, b).slice(1);
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  // Heading east then north is a left turn; east then south is a right turn (and mirrored for west).
  const turn = Math.abs(dx) < 1e-7 || Math.abs(dy) < 1e-7 ? 'straight' : dx * dy > 0 ? 'left' : 'right';
  return { shape: [...first, ...second], corner: first.length - 1, turn, firstM: haversineM(a, c), secondM: haversineM(c, b) };
}
const secs = (m: number) => m / ((KMH * 1000) / 3600);
const manhattan = (a: LatLng, b: LatLng) => haversineM(a, { lat: a.lat, lng: b.lng }) + haversineM({ lat: a.lat, lng: b.lng }, b);

function valhallaRoute(locs: LatLng[]) {
  const legs = [];
  let total = 0;
  for (let i = 0; i + 1 < locs.length; i++) {
    const l = leg(locs[i], locs[i + 1]);
    const len = (l.firstM + l.secondM) / 1000;
    total += len;
    const maneuvers = [{ type: 1, street_names: ['Đường số 1'], time: secs(l.firstM), length: l.firstM / 1000, begin_shape_index: 0 }];
    if (l.turn !== 'straight') maneuvers.push({ type: l.turn === 'left' ? 15 : 10, street_names: ['Đường Tạ Quang Bửu'], time: secs(l.secondM), length: l.secondM / 1000, begin_shape_index: l.corner });
    maneuvers.push({ type: 5, street_names: [], time: 0, length: 0, begin_shape_index: l.shape.length - 1 });
    legs.push({ shape: encodePolyline(l.shape), summary: { length: len, time: secs(len * 1000) }, maneuvers });
  }
  return { trip: { status: 0, units: 'kilometers', summary: { length: total, time: secs(total * 1000) }, legs } };
}

function osrmRoute(locs: LatLng[]) {
  const geometry: LatLng[] = [];
  const legs = [];
  for (let i = 0; i + 1 < locs.length; i++) {
    const l = leg(locs[i], locs[i + 1]);
    geometry.push(...(geometry.length ? l.shape.slice(1) : l.shape));
    const at = (p: LatLng): [number, number] => [p.lng, p.lat];
    const steps = [{ distance: l.firstM, duration: secs(l.firstM), name: 'Đường số 1', maneuver: { type: 'depart', location: at(l.shape[0]) } }];
    if (l.turn !== 'straight') steps.push({ distance: l.secondM, duration: secs(l.secondM), name: 'Đường Tạ Quang Bửu', maneuver: { type: 'turn', modifier: l.turn, location: at(l.shape[l.corner]) } as never });
    steps.push({ distance: 0, duration: 0, name: '', maneuver: { type: 'arrive', location: at(l.shape[l.shape.length - 1]) } });
    legs.push({ distance: l.firstM + l.secondM, duration: secs(l.firstM + l.secondM), steps });
  }
  const distance = legs.reduce((s, l) => s + l.distance, 0);
  return { code: 'Ok', routes: [{ distance, duration: secs(distance), geometry: encodePolyline(geometry), legs }] };
}

export interface MockOptions {
  /** Which routing services answer. Those not listed fail, as when the network blocks them. */
  answer?: ('valhalla' | 'osrm')[];
  /**
   * false: no tile server answers. 'fallback': the first server (OpenStreetMap France) refuses and
   * only the fallbacks answer. 'hang': the first server never answers at all.
   */
  tiles?: boolean | 'fallback' | 'hang';
}

export async function mockMapServices(page: Page, opts: MockOptions = {}) {
  const answer = opts.answer ?? ['valhalla'];
  const calls = { valhalla: 0, osrm: 0, tiles: 0, fallbackTiles: 0 };
  await page.route(/tile\.openstreetmap\.(fr|org|de)\//, (route) => {
    calls.tiles++;
    const fallback = !route.request().url().includes('openstreetmap.fr');
    if (fallback) calls.fallbackTiles++;
    // Real tile servers only have whole zoom levels; anything else is a 404 page, which the browser blocks.
    if (!/\/\d+\/\d+\/\d+\.png$/.test(new URL(route.request().url()).pathname)) return route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' });
    if (opts.tiles === 'hang' && !fallback) return new Promise<void>(() => {});
    const answers = opts.tiles === 'fallback' ? fallback : opts.tiles !== false;
    return answers ? route.fulfill({ status: 200, contentType: 'image/png', body: TILE }) : route.abort('connectionrefused');
  });
  await page.route(/valhalla1\.openstreetmap\.de/, (route) => {
    calls.valhalla++;
    if (!answer.includes('valhalla')) return route.abort('connectionrefused');
    const url = new URL(route.request().url());
    const body = JSON.parse(url.searchParams.get('json') ?? '{}');
    const pt = (l: { lat: number; lon: number }) => ({ lat: l.lat, lng: l.lon });
    if (url.pathname.includes('sources_to_targets')) {
      const src = body.sources.map(pt);
      const dst = body.targets.map(pt);
      const sources_to_targets = src.map((s: LatLng, i: number) =>
        dst.map((t: LatLng, j: number) => {
          const m = manhattan(s, t);
          return { from_index: i, to_index: j, distance: m / 1000, time: secs(m) };
        }),
      );
      return route.fulfill({ json: { units: 'kilometers', sources_to_targets }, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.fulfill({ json: valhallaRoute(body.locations.map(pt)), headers: { 'access-control-allow-origin': '*' } });
  });
  await page.route(/router\.project-osrm\.org/, (route) => {
    calls.osrm++;
    if (!answer.includes('osrm')) return route.abort('connectionrefused');
    const url = new URL(route.request().url());
    const coords = url.pathname.split('/').pop()!.split(';').map((c) => {
      const [lng, lat] = c.split(',').map(Number);
      return { lat, lng };
    });
    if (url.pathname.includes('/table/')) {
      const src = url.searchParams.get('sources')!.split(';').map((i) => coords[+i]);
      const dst = url.searchParams.get('destinations')!.split(';').map((i) => coords[+i]);
      const distances = src.map((s) => dst.map((t) => manhattan(s, t)));
      return route.fulfill({ json: { code: 'Ok', distances, durations: distances.map((r) => r.map(secs)) }, headers: { 'access-control-allow-origin': '*' } });
    }
    return route.fulfill({ json: osrmRoute(coords), headers: { 'access-control-allow-origin': '*' } });
  });
  return calls;
}
