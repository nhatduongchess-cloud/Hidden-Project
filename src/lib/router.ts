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
  | 'hub-map'
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
  'driver',
  'driver-map',
  'driver-live',
  'hub',
  'hub-map',
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
  station: 'hub-stations',
  'hub-overview': 'hub',
  'hub-pilot': 'hub',
};

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#\/?/, '');
  if (h.startsWith('hub-station-')) return { name: 'hub-station', param: h.slice('hub-station-'.length) };
  if (h.startsWith('hub-trace-')) return { name: 'hub-trace', param: h.slice('hub-trace-'.length) };
  if (h.startsWith('driver-nav-')) return { name: 'driver-nav', param: h.slice('driver-nav-'.length) };
  if (h.startsWith('driver-live-')) return { name: 'driver-live', param: h.slice('driver-live-'.length) };
  if ((SIMPLE as string[]).includes(h)) return { name: h as RouteName };
  if (LEGACY[h]) return { name: LEGACY[h] };
  return { name: 'hub' };
}

export function hrefOf(r: Route | RouteName): string {
  const route = typeof r === 'string' ? { name: r } : r;
  if (route.name === 'hub-station' && route.param) return `#hub-station-${route.param}`;
  if (route.name === 'hub-trace' && route.param) return `#hub-trace-${route.param}`;
  if (route.name === 'driver-nav' && route.param) return `#driver-nav-${route.param}`;
  if (!route.name.startsWith('hub') && !route.name.startsWith('driver')) return '#hub';
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
    const on = () => {
      const next = parseHash(location.hash);
      // Normalize retired links from the current URL, never a stale render.
      if (next.name === 'hub' && location.hash !== '#hub') {
        history.replaceState(null, '', `${location.pathname}${location.search}#hub`);
      }
      setR(next);
    };
    window.addEventListener('hashchange', on);
    on();
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

export type Experience = 'site' | 'app' | 'driver' | 'hub' | 'design';
export function experienceOf(r: Route): Experience {
  if (r.name.startsWith('driver')) return 'driver';
  return 'hub';
}
