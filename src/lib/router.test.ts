import { describe, expect, it } from 'vitest';
import { experienceOf, hrefOf, parseHash } from './router';

describe('Hub entry and legacy redirects', () => {
  it('opens Hub for root, project pages and retired consumer pages', () => {
    for (const hash of ['', '#home', '#pilot', '#design', '#explorer', '#explorer-flatten', '#app', '#app-return', '#unknown']) {
      expect(parseHash(hash)).toEqual({ name: 'hub' });
    }
    expect(hrefOf('home')).toBe('#hub');
    expect(experienceOf(parseHash('#home'))).toBe('hub');
  });
  it('preserves operational deep links and driver assignment credentials', () => {
    expect(parseHash('#hub-map')).toEqual({ name: 'hub-map' });
    expect(parseHash('#hub-station-RE-003')).toEqual({ name: 'hub-station', param: 'RE-003' });
    expect(parseHash('#driver-live-token_123')).toEqual({ name: 'driver-live', param: 'token_123' });
    expect(hrefOf({ name: 'hub-station', param: 'RE-003' })).toBe('#hub-station-RE-003');
  });
});
