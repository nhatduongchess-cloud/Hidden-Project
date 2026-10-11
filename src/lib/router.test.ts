import { describe, expect, it } from 'vitest';
import { hrefOf, parseHash } from './router';

describe('explorer links', () => {
  it('opens the station explorer on a named part', () => {
    expect(parseHash('#explorer-flatten')).toEqual({ name: 'explorer', param: 'flatten' });
    expect(hrefOf({ name: 'explorer', param: 'flatten' })).toBe('#explorer-flatten');
  });

  it('keeps the plain explorer link', () => {
    expect(parseHash('#explorer')).toEqual({ name: 'explorer' });
    expect(hrefOf('explorer')).toBe('#explorer');
  });
});
