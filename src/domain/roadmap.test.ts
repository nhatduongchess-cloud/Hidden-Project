import { describe, it, expect, beforeEach } from 'vitest';
import { cumulative, decodePolyline, encodePolyline, fmtDistanceVi, fmtDurationVi, haversineM, inZone, pointAlong, snapToLine, type LatLng } from './geo';
import { instructionVi, prepare, progress, shortInstructionVi, spokenVi, type NavStep, type RoadRoute } from './nav';
import { collectTargets, pointOf, rankNearest, truckPos, type CollectTarget } from './places';
import { createSeedState } from './seed';
import { reducer } from './reducer';
import { DEPOT, PARTNER, matrixMetric, planRoute, type PlanStationInput } from './routing';
import { defaultDispatchConfig, planInputs } from './dispatch';
import {
  clearRoutingCache,
  estimateMatrix,
  estimateRoute,
  fetchMatrix,
  fetchRoute,
  osrmTableUrl,
  parseOsrmRoute,
  parseOsrmTable,
  parseValhallaMatrix,
  parseValhallaRoute,
  valhallaRouteUrl,
  DETOUR_FACTOR,
} from '../integrations/roadRouting';

const NOW = new Date('2026-10-10T10:00:00').getTime();

/** Move a point by metres north and east. */
function offset(p: LatLng, northM: number, eastM: number): LatLng {
  return { lat: p.lat + northM / 111_195, lng: p.lng + eastM / (111_195 * Math.cos((p.lat * Math.PI) / 180)) };
}

const A: LatLng = { lat: 10.87, lng: 106.8 };

describe('geo helpers', () => {
  it('measures distance on the sphere', () => {
    expect(haversineM(A, offset(A, 1000, 0))).toBeCloseTo(1000, -1);
    expect(haversineM(A, offset(A, 0, 500))).toBeCloseTo(500, -1);
  });

  it('decodes the reference Google polyline and round-trips precision 6', () => {
    const ref = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@', 5);
    expect(ref).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
    const pts = [A, offset(A, 120, -40), offset(A, 300, 250)];
    const back = decodePolyline(encodePolyline(pts, 6), 6);
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(pts[i].lat, 6);
      expect(p.lng).toBeCloseTo(pts[i].lng, 6);
    });
  });

  it('snaps a point onto the line and walks along it', () => {
    const line = [A, offset(A, 500, 0), offset(A, 500, 300)];
    const cum = cumulative(line);
    const snap = snapToLine(line, cum, offset(A, 200, 20));
    expect(snap.index).toBe(0);
    expect(snap.along).toBeCloseTo(200, 0);
    expect(snap.offM).toBeCloseTo(20, 0);
    const mid = pointAlong(line, cum, 650);
    expect(mid.index).toBe(1);
    expect(haversineM(mid.point, offset(A, 500, 150))).toBeLessThan(1);
    expect(mid.heading).toBeCloseTo(90, 0);
  });

  it('formats distances and durations the way a navigation banner reads', () => {
    expect(fmtDistanceVi(4)).toBe('10 m');
    expect(fmtDistanceVi(87)).toBe('90 m');
    expect(fmtDistanceVi(312)).toBe('300 m');
    expect(fmtDistanceVi(980)).toBe('1,0 km');
    expect(fmtDistanceVi(1234)).toBe('1,2 km');
    expect(fmtDistanceVi(12_400)).toBe('12 km');
    expect(fmtDurationVi(20)).toBe('1 phút');
    expect(fmtDurationVi(420)).toBe('7 phút');
    expect(fmtDurationVi(3900)).toBe('1 giờ 05 phút');
  });

  it('tests membership of the collection zone', () => {
    const zone = { ...A, radiusKm: 1 };
    expect(inZone(offset(A, 900, 0), zone)).toBe(true);
    expect(inZone(offset(A, 0, 1100), zone)).toBe(false);
  });
});

describe('Vietnamese turn instructions', () => {
  const step = (s: Partial<NavStep>): NavStep => ({ kind: 'turn', name: '', distanceM: 0, durationS: 0, at: 0, leg: 0, ...s });
  it('reads turns, roundabouts and arrival', () => {
    expect(instructionVi(step({ modifier: 'right', name: 'Đường Tô Vĩnh Diện' }))).toBe('Rẽ phải vào Đường Tô Vĩnh Diện');
    expect(instructionVi(step({ modifier: 'slight_left' }))).toBe('Chếch sang trái');
    expect(instructionVi(step({ kind: 'roundabout', exit: 2, name: 'Xa lộ Hà Nội' }))).toBe('Vào vòng xuyến, đi theo lối ra thứ 2 vào Xa lộ Hà Nội');
    expect(instructionVi(step({ kind: 'arrive', modifier: 'right' }), 'Thư viện trung tâm')).toBe('Đến Thư viện trung tâm, ở bên phải');
    expect(shortInstructionVi(step({ modifier: 'left' }))).toBe('Rẽ trái');
    expect(spokenVi(200, step({ modifier: 'left', name: 'Đường số 6' }))).toBe('Sau 200 m, rẽ trái vào Đường số 6');
  });
});

/** North 500 m, turn right, east 300 m. */
function lRoute(): RoadRoute {
  const geometry = [A, offset(A, 250, 0), offset(A, 500, 0), offset(A, 500, 150), offset(A, 500, 300)];
  return {
    provider: 'valhalla',
    profile: 'truck',
    distanceM: 800,
    durationS: 160,
    geometry,
    steps: [
      { kind: 'depart', name: 'Đường A', distanceM: 500, durationS: 100, at: 0, leg: 0 },
      { kind: 'turn', modifier: 'right', name: 'Đường B', distanceM: 300, durationS: 60, at: 2, leg: 0 },
      { kind: 'arrive', name: '', distanceM: 0, durationS: 0, at: 4, leg: 0 },
    ],
    legEnds: [4],
    legs: [{ distanceM: 800, durationS: 160 }],
  };
}

describe('navigation progress', () => {
  it('finds the next maneuver, remaining distance and time', () => {
    const p = prepare(lRoute());
    const at = progress(p, offset(A, 200, 5));
    expect(at.next).toBe(1);
    expect(at.distToNextM).toBeCloseTo(300, -1);
    expect(at.remainingM).toBeCloseTo(600, -1);
    // 300 m of the 500 m first step left (60 s) plus the whole second step (60 s).
    expect(at.remainingS).toBeCloseTo(120, -1);
    expect(at.offRouteM).toBeLessThan(10);
    expect(at.arrived).toBe(false);
  });

  it('after the turn the next maneuver is arrival', () => {
    const at = progress(prepare(lRoute()), offset(A, 500, 100));
    expect(at.next).toBe(2);
    expect(at.distToNextM).toBeCloseTo(200, -1);
  });

  it('flags a vehicle that has left the route and one that has arrived', () => {
    const p = prepare(lRoute());
    expect(progress(p, offset(A, 250, 80)).offRouteM).toBeGreaterThan(70);
    expect(progress(p, offset(A, 500, 290)).arrived).toBe(true);
  });

  it('does not jump back to an earlier pass of the same road', () => {
    // Out 300 m and back on the same street: the return pass must win once it has started.
    const out = offset(A, 300, 0);
    const route: RoadRoute = { ...lRoute(), geometry: [A, out, offset(A, 0, 1)], steps: [], legEnds: [2], distanceM: 600 };
    const p = prepare(route);
    const back = progress(p, offset(A, 100, 0), 450);
    expect(back.along).toBeGreaterThan(400);
  });
});

/* ---------- Provider parsers ---------- */

const B = offset(A, 500, 0);
const C = offset(A, 500, 300);
const D = offset(A, 900, 300);

function valhallaFixture() {
  return {
    trip: {
      units: 'kilometers',
      summary: { length: 1.2, time: 260 },
      legs: [
        {
          shape: encodePolyline([A, offset(A, 250, 0), B]),
          summary: { length: 0.5, time: 110 },
          maneuvers: [
            { type: 1, street_names: ['Đường A'], time: 100, length: 0.5, begin_shape_index: 0 },
            { type: 5, time: 0, length: 0, begin_shape_index: 2 },
          ],
        },
        {
          shape: encodePolyline([B, C, D]),
          summary: { length: 0.7, time: 150 },
          maneuvers: [
            { type: 1, street_names: ['Đường A'], time: 0, length: 0, begin_shape_index: 0 },
            { type: 10, street_names: ['Đường B'], time: 60, length: 0.3, begin_shape_index: 0 },
            { type: 15, street_names: ['Đường C'], time: 90, length: 0.4, begin_shape_index: 1 },
            { type: 4, time: 0, length: 0, begin_shape_index: 2 },
          ],
        },
      ],
    },
  };
}

function osrmFixture() {
  const geometry = [A, offset(A, 250, 0), B, C, D];
  const loc = (p: LatLng): [number, number] => [p.lng, p.lat];
  return {
    code: 'Ok',
    routes: [
      {
        distance: 1200,
        duration: 250,
        geometry: encodePolyline(geometry),
        legs: [
          {
            distance: 500,
            duration: 100,
            steps: [
              { distance: 500, duration: 100, name: 'Đường A', maneuver: { type: 'depart', location: loc(A) } },
              { distance: 0, duration: 0, name: 'Đường A', maneuver: { type: 'arrive', modifier: 'left', location: loc(B) } },
            ],
          },
          {
            distance: 700,
            duration: 150,
            steps: [
              { distance: 300, duration: 60, name: 'Đường B', maneuver: { type: 'depart', modifier: 'right', location: loc(B) } },
              { distance: 400, duration: 90, name: 'Đường C', maneuver: { type: 'turn', modifier: 'left', location: loc(C) } },
              { distance: 0, duration: 0, name: 'Đường C', maneuver: { type: 'arrive', location: loc(D) } },
            ],
          },
        ],
      },
    ],
  };
}

describe('Valhalla parser', () => {
  it('joins legs into one line and places maneuvers on it', () => {
    const r = parseValhallaRoute(valhallaFixture());
    expect(r.provider).toBe('valhalla');
    expect(r.profile).toBe('truck');
    expect(r.geometry).toHaveLength(5);
    expect(r.legEnds).toEqual([2, 4]);
    expect(r.steps.map((s) => [s.kind, s.modifier ?? '', s.at, s.leg])).toEqual([
      ['depart', '', 0, 0],
      ['arrive', 'right', 2, 0],
      ['depart', '', 2, 1],
      ['turn', 'right', 2, 1],
      ['turn', 'left', 3, 1],
      ['arrive', '', 4, 1],
    ]);
    expect(r.distanceM).toBeCloseTo(1200);
    expect(r.legs.map((l) => l.distanceM)).toEqual([500, 700]);
    expect(r.durationS).toBe(260);
  });

  it('reads both matrix forms', () => {
    const verbose = parseValhallaMatrix(
      { units: 'kilometers', sources_to_targets: [[{ from_index: 0, to_index: 0, time: 120, distance: 0.9 }, { from_index: 0, to_index: 1, time: null, distance: null }]] },
      1,
      2,
    );
    expect(verbose.durationsS).toEqual([[120, null]]);
    expect(verbose.distancesM[0][0]).toBeCloseTo(900);
    const concise = parseValhallaMatrix({ sources_to_targets: { durations: [[60, 90]], distances: [[0.4, 1.1]] } }, 1, 2);
    expect(concise.durationsS).toEqual([[60, 90]]);
    expect(concise.distancesM[0][1]).toBeCloseTo(1100);
  });

  it('rejects an answer without a trip', () => {
    expect(() => parseValhallaRoute({ error: 'No path could be found' })).toThrow();
  });

  it('asks for the truck profile with the truck dimensions', () => {
    const body = JSON.parse(decodeURIComponent(valhallaRouteUrl([A, B]).split('json=')[1]));
    expect(body.costing).toBe('truck');
    expect(body.costing_options.truck.height).toBe(2.5);
    expect(body.locations).toHaveLength(2);
  });
});

describe('OSRM parser', () => {
  it('locates each maneuver on the overview line and keeps every leg', () => {
    const r = parseOsrmRoute(osrmFixture());
    expect(r.provider).toBe('osrm');
    expect(r.profile).toBe('car');
    expect(r.geometry).toHaveLength(5);
    expect(r.legEnds).toEqual([2, 4]);
    expect(r.steps.map((s) => [s.kind, s.modifier ?? '', s.at, s.leg])).toEqual([
      ['depart', '', 0, 0],
      ['arrive', 'left', 2, 0],
      ['depart', 'right', 2, 1],
      ['turn', 'left', 3, 1],
      ['arrive', '', 4, 1],
    ]);
    expect(r.legs.map((l) => l.durationS)).toEqual([100, 150]);
  });

  it('reads the table and builds a sources/destinations request', () => {
    const m = parseOsrmTable({ code: 'Ok', durations: [[10, 20]], distances: [[100, 200]] });
    expect(m.durationsS).toEqual([[10, 20]]);
    expect(osrmTableUrl([A], [B, C])).toContain('sources=0&destinations=1;2&annotations=duration,distance');
    expect(() => parseOsrmTable({ code: 'NoTable' })).toThrow();
  });
});

describe('fallback chain', () => {
  beforeEach(() => clearRoutingCache());
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

  it('uses OSRM when Valhalla does not answer, and says so', async () => {
    const fetchImpl = ((url: string) => (url.includes('valhalla') ? Promise.reject(new TypeError('Failed to fetch')) : ok(osrmFixture()))) as unknown as typeof fetch;
    const r = await fetchRoute([A, B, D], { fetchImpl });
    expect(r.value.provider).toBe('osrm');
    expect(r.failed.map((f) => f.provider)).toEqual(['valhalla']);
  });

  it('falls back to a labelled straight-line estimate when nothing answers', async () => {
    const fetchImpl = (() => Promise.resolve(new Response('busy', { status: 503 }))) as unknown as typeof fetch;
    const r = await fetchRoute([A, C], { fetchImpl });
    expect(r.value.provider).toBe('estimate');
    expect(r.value.profile).toBe('straight');
    expect(r.value.distanceM).toBeCloseTo(haversineM(A, C) * DETOUR_FACTOR, 3);
    expect(r.failed.map((f) => f.provider)).toEqual(['valhalla', 'osrm']);
    const m = await fetchMatrix([A], [B, C], { fetchImpl });
    expect(m.value.provider).toBe('estimate');
    expect(m.value.durationsS[0]).toHaveLength(2);
  });

  it('caches a road answer but retries after an estimate', async () => {
    let calls = 0;
    const fetchImpl = ((url: string) => {
      calls++;
      return url.includes('valhalla') ? ok(valhallaFixture()) : Promise.reject(new Error('unused'));
    }) as unknown as typeof fetch;
    await fetchRoute([A, B, D], { fetchImpl });
    await fetchRoute([A, B, D], { fetchImpl });
    expect(calls).toBe(1);
  });

  it('estimates one leg per pair of points', () => {
    const r = estimateRoute([A, B, C]);
    expect(r.legs).toHaveLength(2);
    expect(r.legEnds).toEqual([1, 2]);
    expect(r.steps[2]).toMatchObject({ kind: 'depart', modifier: 'right' });
    expect(estimateMatrix([A], [B]).distancesM[0][0]).toBeCloseTo(500 * DETOUR_FACTOR, -1);
  });
});

/* ---------- Places, nearest station, road-aware planning ---------- */

describe('nearest station for the driver', () => {
  it('lists stations that need collection with their zone and status', () => {
    const s = createSeedState(NOW);
    const t = collectTargets(s, NOW);
    expect(t.map((x) => x.id).sort()).toEqual(['RE-001', 'RE-002', 'RE-003']);
    expect(t.find((x) => x.id === 'RE-003')).toMatchObject({ cls: 'priority', inZone: true });
    expect(t.find((x) => x.id === 'RE-002')?.stale).toBe(true);
    expect(truckPos(s)).toEqual({ lat: s.settings.depot.lat, lng: s.settings.depot.lng });
    expect(pointOf(s, PARTNER)?.kind).toBe('partner');
  });

  it('ranks by road time, not straight-line distance, and leaves out-of-zone stations', () => {
    const mk = (id: string, p: LatLng, zone = true): CollectTarget => ({
      id, name: id, site: '', ...p, cls: 'required', reason: 'at_threshold', fillPct: 85, stale: false, fault: null, inZone: zone, onRoute: false,
    });
    // X is closest as the crow flies but takes longest (across the river); Y is the fastest.
    const targets = [mk('X', offset(A, 200, 0)), mk('Y', offset(A, 600, 0)), mk('Z', offset(A, 900, 0)), mk('FAR', offset(A, 100, 0), false)];
    const r = rankNearest(A, targets, [900, 140, null, 30], [3200, 700, null, 120]);
    expect(r.inZone.map((x) => x.id)).toEqual(['Y', 'X', 'Z']);
    expect(r.fastestId).toBe('Y');
    expect(r.straightNearestId).toBe('X');
    expect(r.outOfZone.map((x) => x.id)).toEqual(['FAR']);
  });
});

describe('map positions in the store', () => {
  it('moves stations and the depot, and resets them', () => {
    let s = createSeedState(NOW);
    s = reducer(s, { type: 'SET_LOCATION', target: 'RE-001', lat: 10.9, lng: 106.81 });
    s = reducer(s, { type: 'SET_LOCATION', target: DEPOT, lat: 10.85, lng: 106.77 });
    expect(s.stations.find((x) => x.id === 'RE-001')).toMatchObject({ lat: 10.9, lng: 106.81 });
    expect(s.settings.depot).toMatchObject({ lat: 10.85, lng: 106.77 });
    expect(reducer(s, { type: 'SET_LOCATION', target: 'RE-001', lat: NaN, lng: 1 })).toBe(s);
    s = reducer(s, { type: 'RESET_LOCATIONS' });
    expect(s.stations.find((x) => x.id === 'RE-001')!.lat).toBe(createSeedState(NOW).stations[0].lat);
  });

  it('puts the truck at the station it just emptied', () => {
    const s0 = createSeedState(NOW);
    const s = reducer(s0, { type: 'CONFIRM_COLLECTION', stationId: 'RE-003', driver: 'd', ts: NOW, collectionId: 'TG-T1', newBinId: 'BIN-NEW' });
    const st = s.stations.find((x) => x.id === 'RE-003')!;
    expect(s.driverPos).toEqual({ lat: st.lat, lng: st.lng });
  });
});

describe('planner on road travel times', () => {
  it('orders stops by road time when a matrix is available', () => {
    const s = createSeedState(NOW);
    const cfg = { ...defaultDispatchConfig(s), endAt: DEPOT as typeof DEPOT };
    const inputs: PlanStationInput[] = planInputs(s, cfg.nextHours);
    const ids = [DEPOT, 'RE-001', 'RE-002', 'RE-003', PARTNER];
    // Minutes between points; RE-002 → RE-001 is a slow one-way detour.
    const min = [
      [0, 12, 10, 13, 20],
      [12, 0, 3, 2, 22],
      [10, 15, 0, 4, 24],
      [13, 2, 4, 0, 21],
      [20, 22, 24, 21, 0],
    ];
    const metric = matrixMetric(ids, min.map((r) => r.map((m) => m * 60)), min.map((r) => r.map((m) => m * 400)));
    const plan = planRoute(inputs, cfg, metric);
    expect(plan.metric).toBe('road');
    expect(plan.planned!.order).not.toContain('PARTNER');
    // Any order that drives RE-002 → RE-001 pays the 15-minute detour; the best one avoids it.
    const o = plan.planned!.order;
    for (let i = 0; i + 1 < o.length; i++) expect([o[i], o[i + 1]]).not.toEqual(['RE-002', 'RE-001']);
    expect(plan.planned!.distanceKm).toBeCloseTo(plan.planned!.stops.reduce((a, x) => a + x.legKm, 0) + metric.km(o[o.length - 1], DEPOT), 6);
  });
});
