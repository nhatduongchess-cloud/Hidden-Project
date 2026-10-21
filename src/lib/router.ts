import { useEffect, useState } from 'react';

/**
 * Hash router with bare tokens (letters, digits and dashes only), e.g. #hub-station-RE-002.
 * Bare tokens survive static hosting and framed previews, and every screen has a shareable link.
 */
export type RouteName =
  // public website
  | 'home'
  | 'explorer'
  | 'pilot'
  | 'design'
  // mobile app for people returning bottles
  | 'app'
  | 'app-stations'
  | 'app-return'
  | 'app-history'
  | 'app-rewards'
  // driver
  | 'driver'
  | 'driver-map'
  | 'driver-nav'
  | 'driver-live'
  // RE Hub
  | 'hub'
  | 'hub-stations'
  | 'hub-station'
  | 'hub-routes'
  | 'hub-fleet'
  | 'hub-analytics'
  | 'hub-forecasts'
  | 'hub-kpis'
  | 'hub-transactions'
  | 'hub-trace'
  | 'hub-settings';

export interface Route {
  name: RouteName;
  /** Station id for hub-station and driver-nav (also DEPOT / PARTNER), batch id for hub-trace, part for explorer. */
  param?: string;
}

const SIMPLE: RouteName[] = [
  'home',
  'explorer',
  'pilot',
  'design',
  'app',
  'app-stations',
  'app-return',
  'app-history',
  'app-rewards',
  'driver',
  'driver-map',
  'driver-live',
  'hub',
  'hub-stations',
  'hub-routes',
  'hub-fleet',
  'hub-analytics',
  'hub-forecasts',
  'hub-kpis',
  'hub-transactions',
  'hub-trace',
  'hub-settings',
];

const LEGACY: Record<string, RouteName> = {
  station: 'explorer',
  'hub-overview': 'hub',
  'hub-map': 'hub-stations',
  'hub-pilot': 'pilot',
};

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('hub-station-')) return { name: 'hub-station', param: h.slice('hub-station-'.length) };
  if (h.startsWith('hub-trace-')) return { name: 'hub-trace', param: h.slice('hub-trace-'.length) };
  if (h.startsWith('driver-nav-')) return { name: 'driver-nav', param: h.slice('driver-nav-'.length) };
  if (h.startsWith('driver-live-')) return { name: 'driver-live', param: h.slice('driver-live-'.length) };
  if (h.startsWith('explorer-')) return { name: 'explorer', param: h.slice('explorer-'.length) };
  if ((SIMPLE as string[]).includes(h)) return { name: h as RouteName };
  if (LEGACY[h]) return { name: LEGACY[h] };
  return { name: 'home' };
}

export function hrefOf(r: Route | RouteName): string {
  const route = typeof r === 'string' ? { name: r } : r;
  if (route.name === 'hub-station' && route.param) return `#hub-station-${route.param}`;
  if (route.name === 'hub-trace' && route.param) return `#hub-trace-${route.param}`;
  if (route.name === 'driver-nav' && route.param) return `#driver-nav-${route.param}`;
  if (route.name === 'explorer' && route.param) return `#explorer-${route.param}`;
  return `#${route.name}`;
}

export function navigate(r: Route | RouteName, opts: { keepScroll?: boolean } = {}) {
  const target = hrefOf(r);
  if (location.hash !== target) location.hash = target.slice(1);
  if (!opts.keepScroll) window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parseHash(typeof location !== 'undefined' ? location.hash : ''));
  useEffect(() => {
    const on = () => setR(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export type Experience = 'site' | 'app' | 'driver' | 'hub' | 'design';
export function experienceOf(r: Route): Experience {
  if (r.name === 'design') return 'design';
  if (r.name.startsWith('app')) return 'app';
  if (r.name.startsWith('driver')) return 'driver';
  if (r.name.startsWith('hub')) return 'hub';
  return 'site';
}
