import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLng, Zone } from '../domain/geo';
import { ROUTING_ATTRIBUTION } from '../integrations/roadRouting';

/**
 * Road map on OpenStreetMap tiles (Leaflet). Loaded lazily, so pages without a map never pay for it.
 * Everything drawn on it comes from props; the component only diffs them onto Leaflet layers.
 */

export type MarkerTone = 'fault' | 'amber' | 'forest' | 'slate' | 'neutral';

export interface MapMarker extends LatLng {
  id: string;
  kind: 'station' | 'depot' | 'partner' | 'truck';
  /** Short text under the pin, e.g. "RE-003". */
  label?: string;
  tone?: MarkerTone;
  /** Stop number inside the pin. */
  order?: number;
  selected?: boolean;
  /** Truck direction, degrees clockwise from north. */
  heading?: number;
  /** Accessible name and tooltip. */
  title: string;
  draggable?: boolean;
}

export interface MapLine {
  id: string;
  points: LatLng[];
  /** route: the road to drive; travelled: already driven; preview: a road not yet chosen;
   *  baseline: the comparison order; estimate: straight lines when no road data is available. */
  kind: 'route' | 'travelled' | 'preview' | 'baseline' | 'estimate';
}

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RoadMapProps {
  markers: MapMarker[];
  lines?: MapLine[];
  zone?: Zone | null;
  /** Change this value to fit the view to `fitPoints`, or to everything on the map. */
  fitKey?: string;
  fitPoints?: LatLng[];
  /** Space covered by overlays (banner, bottom sheet), kept clear when fitting and following. */
  padding?: Padding;
  /** Keep this point in view, as navigation does. */
  follow?: LatLng | null;
  followZoom?: number;
  onMarkerClick?: (id: string) => void;
  onMarkerDrag?: (id: string, p: LatLng) => void;
  /** The person dragged the map (navigation stops following until they recenter). */
  onUserMove?: () => void;
  label: string;
  className?: string;
  zoomControl?: boolean;
}

/**
 * Keyless raster tiles from OpenStreetMap. CARTO's basemaps were dropped: they now answer every
 * request without an API key with an "API key required" image, which never triggers a fallback.
 */
/** How long the first tile may take before trying the next provider. */
const TILE_WAIT_MS = 5000;
const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const TILES: { url: string; options: L.TileLayerOptions }[] = [
  {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: OSM },
  },
  {
    url: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    options: {
      subdomains: 'abc',
      maxZoom: 19,
      attribution: `${OSM} · nền <a href="https://www.openstreetmap.fr" target="_blank" rel="noopener">OpenStreetMap France</a>`,
    },
  },
];

const NO_PAD: Padding = { top: 0, right: 0, bottom: 0, left: 0 };

function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(',')})` : fallback;
}

function lineStyles(kind: MapLine['kind']): L.PolylineOptions[] {
  const route = token('route', 'rgb(26,102,214)');
  const routeInk = token('route-ink', 'rgb(16,70,156)');
  const base = { interactive: false, lineCap: 'round' as const, lineJoin: 'round' as const };
  switch (kind) {
    case 'route':
      return [
        { ...base, color: routeInk, weight: 10, opacity: 1 },
        { ...base, color: route, weight: 6.5, opacity: 1 },
      ];
    case 'preview':
      return [
        { ...base, color: routeInk, weight: 8, opacity: 0.55 },
        { ...base, color: route, weight: 5, opacity: 0.8 },
      ];
    case 'travelled':
      return [{ ...base, color: 'rgb(150,156,162)', weight: 6.5, opacity: 0.9 }];
    case 'baseline':
      return [{ ...base, color: token('muted', 'rgb(96,99,93)'), weight: 3, opacity: 0.8, dashArray: '6 7' }];
    case 'estimate':
      return [{ ...base, color: route, weight: 4, opacity: 0.9, dashArray: '2 9' }];
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function markerHtml(m: MapMarker): string {
  if (m.kind === 'truck') {
    return `<div class="re-truck"><div class="re-truck__rot"><svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true"><circle cx="22" cy="22" r="20" class="re-truck__halo"/><circle cx="22" cy="22" r="13" class="re-truck__disc"/><path d="M22 12.5l7 15-7-3.6-7 3.6z" class="re-truck__arrow"/></svg></div></div>`;
  }
  if (m.kind === 'depot' || m.kind === 'partner') {
    const glyph =
      m.kind === 'depot'
        ? '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5.5h4V20"/>'
        : '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>';
    return `<div class="re-place ${m.selected ? 'is-selected' : ''}"><span class="re-place__box"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg></span>${m.label ? `<span class="re-pin__label">${esc(m.label)}</span>` : ''}</div>`;
  }
  return `<div class="re-pin re-pin--${m.tone ?? 'neutral'} ${m.selected ? 'is-selected' : ''}"><span class="re-pin__dot">${m.order != null ? m.order : ''}</span>${m.label ? `<span class="re-pin__label">${esc(m.label)}</span>` : ''}</div>`;
}

function iconFor(m: MapMarker): L.DivIcon {
  const size = m.kind === 'truck' ? 44 : m.kind === 'station' ? (m.selected ? 34 : 28) : 30;
  return L.divIcon({ html: markerHtml(m), className: 're-marker', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

export default function RoadMap({
  markers,
  lines = [],
  zone,
  fitKey,
  fitPoints,
  padding = NO_PAD,
  follow,
  followZoom,
  onMarkerClick,
  onMarkerDrag,
  onUserMove,
  label,
  className = '',
  zoomControl = true,
}: RoadMapProps) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markerLayer = useRef(new Map<string, { marker: L.Marker; html: string; dragging: boolean }>());
  const lineLayer = useRef(new Map<string, { kind: MapLine['kind']; layers: L.Polyline[] }>());
  const zoneLayer = useRef<L.Circle | null>(null);
  const cb = useRef({ onMarkerClick, onMarkerDrag, onUserMove });
  cb.current = { onMarkerClick, onMarkerDrag, onUserMove };
  const [tiles, setTiles] = useState<'ok' | 'failed'>('ok');

  // Create the map once.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: false, center: [10.875, 106.8], zoom: 14, zoomSnap: 0.25 });
    const attribution = L.control.attribution({ prefix: '<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>' }).addTo(m).addAttribution(ROUTING_ATTRIBUTION);
    if (zoomControl) L.control.zoom({ position: 'topright', zoomInTitle: 'Phóng to', zoomOutTitle: 'Thu nhỏ' }).addTo(m);
    // Base tiles, falling back to the next provider if the first never loads a tile: after four tile
    // errors, or after TILE_WAIT_MS with nothing loaded (a blocked host can hang instead of failing).
    // The layer is re-pointed rather than removed: removing a layer mid-zoom breaks Leaflet's animation.
    let provider = 0;
    let loaded = 0;
    let errors = 0;
    let watchdog = 0;
    const tileLayer = L.tileLayer(TILES[0].url, TILES[0].options).addTo(m);
    // Leaflet 1.9.4's redraw(), which setUrl calls, takes the map's fractional zoom (zoomSnap 0.25) as
    // the tile zoom and asks for tiles like /13.25/x/y that no server has. Round it, as _setView does.
    const grid = tileLayer as unknown as { _clampZoom(zoom: number): number };
    const clampZoom = grid._clampZoom.bind(tileLayer);
    grid._clampZoom = (zoom) => clampZoom(Math.round(zoom));
    const arm = () => {
      window.clearTimeout(watchdog);
      if (provider + 1 < TILES.length) watchdog = window.setTimeout(next, TILE_WAIT_MS);
    };
    function next() {
      window.clearTimeout(watchdog);
      if (map.current !== m || loaded > 0) return;
      provider++;
      if (provider >= TILES.length) {
        setTiles('failed');
        return;
      }
      errors = 0;
      const t = TILES[provider];
      tileLayer.options.subdomains = t.options.subdomains ?? 'abc';
      tileLayer.options.maxZoom = t.options.maxZoom;
      tileLayer.getAttribution = () => t.options.attribution ?? '';
      attribution.removeAttribution(TILES[provider - 1].options.attribution ?? '').addAttribution(t.options.attribution ?? '');
      tileLayer.setUrl(t.url);
      arm();
    }
    tileLayer.on('tileload', () => {
      loaded++;
      window.clearTimeout(watchdog);
      setTiles('ok');
    });
    tileLayer.on('tileerror', () => {
      errors++;
      if (loaded > 0 || errors !== 4) return;
      window.setTimeout(next, 0);
    });
    arm();
    m.on('dragstart', () => cb.current.onUserMove?.());
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      window.clearTimeout(watchdog);
      ro.disconnect();
      m.remove();
      map.current = null;
      markerLayer.current.clear();
      lineLayer.current.clear();
      zoneLayer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zone circle.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!zone) {
      zoneLayer.current?.remove();
      zoneLayer.current = null;
      return;
    }
    const opts: L.PathOptions = { color: token('forest', 'rgb(30,86,60)'), weight: 1.5, dashArray: '5 6', fillColor: token('forest', 'rgb(30,86,60)'), fillOpacity: 0.05, interactive: false };
    if (!zoneLayer.current) zoneLayer.current = L.circle([zone.lat, zone.lng], { ...opts, radius: zone.radiusKm * 1000 }).addTo(m);
    else zoneLayer.current.setLatLng([zone.lat, zone.lng]).setRadius(zone.radiusKm * 1000);
  }, [zone?.lat, zone?.lng, zone?.radiusKm, zone]);

  // Lines, diffed by id.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const line of lines) {
      seen.add(line.id);
      const pts = line.points.map((p) => [p.lat, p.lng] as [number, number]);
      const cur = lineLayer.current.get(line.id);
      if (cur && cur.kind === line.kind) {
        cur.layers.forEach((l) => l.setLatLngs(pts));
        continue;
      }
      cur?.layers.forEach((l) => l.remove());
      lineLayer.current.set(line.id, { kind: line.kind, layers: lineStyles(line.kind).map((s) => L.polyline(pts, s).addTo(m)) });
    }
    for (const [id, cur] of lineLayer.current) {
      if (!seen.has(id)) {
        cur.layers.forEach((l) => l.remove());
        lineLayer.current.delete(id);
      }
    }
    // Draw order: baseline, travelled, preview, route.
    const rank: Record<MapLine['kind'], number> = { baseline: 0, estimate: 1, travelled: 2, preview: 3, route: 4 };
    [...lineLayer.current.values()].sort((a, b) => rank[a.kind] - rank[b.kind]).forEach((c) => c.layers.forEach((l) => l.bringToFront()));
  }, [lines]);

  // Markers, diffed by id. The truck's heading is applied directly so it can turn smoothly.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const spec of markers) {
      seen.add(spec.id);
      const html = markerHtml({ ...spec, heading: undefined });
      let cur = markerLayer.current.get(spec.id);
      if (!cur) {
        const marker = L.marker([spec.lat, spec.lng], {
          icon: iconFor(spec),
          title: spec.title,
          alt: spec.title,
          keyboard: spec.kind !== 'truck',
          draggable: !!spec.draggable,
          zIndexOffset: spec.kind === 'truck' ? 1000 : spec.selected ? 500 : 0,
          autoPan: true,
        }).addTo(m);
        const entry = { marker, html, dragging: false };
        marker.on('click', () => cb.current.onMarkerClick?.(spec.id));
        marker.on('dragstart', () => (entry.dragging = true));
        marker.on('dragend', () => {
          entry.dragging = false;
          const p = marker.getLatLng();
          cb.current.onMarkerDrag?.(spec.id, { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) });
        });
        markerLayer.current.set(spec.id, entry);
        cur = entry;
      } else {
        if (cur.html !== html) {
          cur.marker.setIcon(iconFor(spec));
          cur.marker.setZIndexOffset(spec.kind === 'truck' ? 1000 : spec.selected ? 500 : 0);
          cur.html = html;
        }
        if (!cur.dragging) {
          const p = cur.marker.getLatLng();
          if (p.lat !== spec.lat || p.lng !== spec.lng) cur.marker.setLatLng([spec.lat, spec.lng]);
        }
        if (cur.marker.dragging) spec.draggable ? cur.marker.dragging.enable() : cur.marker.dragging.disable();
      }
      if (spec.kind === 'truck') {
        const rot = cur.marker.getElement()?.querySelector<HTMLElement>('.re-truck__rot');
        if (rot) rot.style.transform = `rotate(${Math.round(spec.heading ?? 0)}deg)`;
      }
    }
    for (const [id, cur] of markerLayer.current) {
      if (!seen.has(id)) {
        cur.marker.remove();
        markerLayer.current.delete(id);
      }
    }
  }, [markers]);

  // Keep zoom buttons and attribution inside the area the overlays leave visible.
  useEffect(() => {
    const c = map.current?.getContainer();
    if (!c) return;
    c.querySelectorAll<HTMLElement>('.leaflet-top').forEach((e) => (e.style.top = `${padding.top}px`));
    c.querySelectorAll<HTMLElement>('.leaflet-bottom').forEach((e) => (e.style.bottom = `${padding.bottom}px`));
    c.querySelectorAll<HTMLElement>('.leaflet-left').forEach((e) => (e.style.left = `${padding.left}px`));
    c.querySelectorAll<HTMLElement>('.leaflet-right').forEach((e) => (e.style.right = `${padding.right}px`));
  }, [padding.top, padding.bottom, padding.left, padding.right]);

  // Fit the view to everything when asked.
  useEffect(() => {
    const m = map.current;
    if (!m || fitKey === undefined) return;
    const pts: L.LatLngExpression[] = [];
    if (fitPoints?.length) fitPoints.forEach((p) => pts.push([p.lat, p.lng]));
    else {
      markers.forEach((x) => pts.push([x.lat, x.lng]));
      lines.forEach((l) => l.points.forEach((p) => pts.push([p.lat, p.lng])));
    }
    let bounds = pts.length ? L.latLngBounds(pts) : null;
    if (zone && (!bounds || pts.length < 2)) {
      const zb = L.latLng(zone.lat, zone.lng).toBounds(zone.radiusKm * 2000);
      bounds = bounds ? bounds.extend(zb) : zb;
    }
    if (!bounds) return;
    // Extra room so pins and their labels at the edge stay clear of the zoom buttons.
    m.fitBounds(bounds, { paddingTopLeft: [padding.left + 44, padding.top + 44], paddingBottomRight: [padding.right + 52, padding.bottom + 52], maxZoom: 17, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Follow a moving point, centred in the area the overlays leave visible.
  useEffect(() => {
    const m = map.current;
    if (!m || !follow) return;
    const z = followZoom ?? m.getZoom();
    const offset = L.point((padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2);
    const center = m.unproject(m.project([follow.lat, follow.lng], z).subtract(offset), z);
    m.setView(center, z, { animate: true, duration: 0.35 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [follow?.lat, follow?.lng, followZoom]);

  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} isolate overflow-hidden bg-[rgb(232_234_228)] ${className}`}>
      <div ref={el} className="re-map absolute inset-0" role="region" aria-label={label} />
      {tiles === 'failed' && (
        <div className="pointer-events-none absolute left-3 right-14 top-3 z-[500] rounded border border-line bg-panel/95 px-3 py-2 text-xs text-ink-2 shadow-1" role="status" style={{ top: padding.top + 12 }}>
          Không tải được bản đồ nền (mất mạng hoặc trang xem trước chặn kết nối ngoài). Vị trí và tuyến vẫn hiển thị.
        </div>
      )}
    </div>
  );
}
