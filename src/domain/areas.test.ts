import { describe, expect, it } from 'vitest';
import { AREAS, DEFAULT_AREA_ID, REGIONS, areaById, areaLabel, nearestArea } from './areas';
import { DEFAULT_SETTINGS, DEFAULT_STATION_LOCATIONS } from './constants';
import { haversineM, inZone } from './geo';
import { createSeedState } from './seed';
import { reducer } from './reducer';

const NOW = Date.UTC(2026, 9, 11, 3);
/** Mainland Viet Nam with a small margin. */
const inVietnam = (p: { lat: number; lng: number }) => p.lat > 8.3 && p.lat < 23.5 && p.lng > 102 && p.lng < 109.6;

describe('service areas', () => {
  it('cover the north, centre, highlands and south, each area once', () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    expect(AREAS.length).toBeGreaterThanOrEqual(10);
    for (const r of REGIONS) expect(AREAS.some((a) => a.region === r)).toBe(true);
  });

  it('keep every point on the mainland, with all three stations inside the collection zone', () => {
    for (const a of AREAS) {
      for (const p of [a.zone, a.depot, a.partner, ...Object.values(a.stations)]) expect(inVietnam(p), `${a.id} ${p.lat},${p.lng}`).toBe(true);
      expect(Object.keys(a.stations).sort()).toEqual(['RE-001', 'RE-002', 'RE-003']);
      for (const st of Object.values(a.stations)) expect(inZone(st, a.zone), a.id).toBe(true);
      // The depot and receiving point are in the same city, not across the country.
      expect(haversineM(a.depot, a.zone)).toBeLessThan(20_000);
      expect(haversineM(a.partner, a.zone)).toBeLessThan(40_000);
    }
  });

  it('default to TP.HCM, which is what the demo showed before areas existed', () => {
    const hcm = areaById(DEFAULT_AREA_ID);
    expect(areaLabel(hcm)).toBe('TP.HCM');
    expect(DEFAULT_SETTINGS.zone).toEqual(hcm.zone);
    expect(DEFAULT_SETTINGS.depot).toMatchObject(hcm.depot);
    expect(DEFAULT_STATION_LOCATIONS).toEqual(hcm.stations);
    expect(areaById(undefined).id).toBe('hcm');
    expect(areaById('nowhere').id).toBe('hcm');
  });

  it('finds the nearest area to a position', () => {
    expect(nearestArea({ lat: 21.0285, lng: 105.8542 }).area.id).toBe('hn');
    const ct = nearestArea({ lat: 10.04, lng: 105.78 });
    expect(ct.area.id).toBe('ct');
    expect(ct.km).toBeLessThan(5);
  });
});

describe('APPLY_AREA', () => {
  it('moves the stations, depot, receiving point and zone, and parks the truck at the new depot', () => {
    const hn = areaById('hn');
    let s = reducer(createSeedState(NOW), { type: 'SET_DRIVER_POS', pos: { lat: 10.87, lng: 106.8 } });
    s = reducer(s, { type: 'APPLY_AREA', areaId: 'hn' });
    expect(s.settings.areaId).toBe('hn');
    expect(s.settings.zone).toEqual(hn.zone);
    expect(s.settings.depot).toEqual({ ...hn.depot, name: DEFAULT_SETTINGS.depot.name });
    expect(s.settings.partner).toEqual({ ...hn.partner, name: DEFAULT_SETTINGS.partner.name });
    for (const st of s.stations) expect({ lat: st.lat, lng: st.lng }).toEqual(hn.stations[st.id]);
    expect(s.driverPos).toBeNull();
  });

  it('can keep a GPS position when switching to the area the truck is in', () => {
    const gps = { lat: 21.03, lng: 105.79 };
    let s = reducer(createSeedState(NOW), { type: 'SET_DRIVER_POS', pos: gps });
    s = reducer(s, { type: 'APPLY_AREA', areaId: 'hn', keepDriverPos: true });
    expect(s.driverPos).toEqual(gps);
  });

  it('ignores an unknown area', () => {
    const s = createSeedState(NOW);
    expect(reducer(s, { type: 'APPLY_AREA', areaId: 'nowhere' })).toBe(s);
  });

  it('resets locations to the chosen area, not always to TP.HCM', () => {
    let s = reducer(createSeedState(NOW), { type: 'APPLY_AREA', areaId: 'dn' });
    s = reducer(s, { type: 'SET_LOCATION', target: 'RE-001', lat: 16.1, lng: 108.2 });
    s = reducer(s, { type: 'RESET_LOCATIONS' });
    expect(s.stations.find((x) => x.id === 'RE-001')).toMatchObject(areaById('dn').stations['RE-001']);
  });
});
