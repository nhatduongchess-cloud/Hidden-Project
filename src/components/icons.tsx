import type { SVGProps } from 'react';

/**
 * RE icon set: 24 × 24 grid, 1.75 px stroke, square caps where the subject is mechanical.
 * Drawn for this product so status icons stay consistent across the website, app and RE Hub.
 */
const P: Record<string, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  arrowRight: 'M4 12h15M13 6l6 6-6 6',
  arrowLeft: 'M20 12H5M11 6l-6 6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  // status
  alert: 'M12 4l9 16H3L12 4zM12 10v4.5M12 17.2v.3',
  stop: 'M8.2 3h7.6L21 8.2v7.6L15.8 21H8.2L3 15.8V8.2L8.2 3zM8.5 12h7',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.3',
  checkCircle: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.3l2.8 2.8L16.2 9.6',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.6a10 10 0 015.2-2.5M14.5 10.2A10 10 0 0119 12.6M2 9a15 15 0 014.6-2.9M11 5.1A15 15 0 0122 9M12 20h.01',
  wifi: 'M5 12.6a10 10 0 0114 0M2 9a15 15 0 0120 0M8.5 16.5a5 5 0 017 0M12 20h.01',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3.5 2',
  sync: 'M20 11a8 8 0 00-14.3-4.3L4 9M4 4v5h5M4 13a8 8 0 0014.3 4.3L20 15M20 20v-5h-5',
  // domain
  bottle: 'M10 2.5h4M10.5 2.5v3l-2.3 3.2a3 3 0 00-.7 1.9V20a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5v-9.4a3 3 0 00-.7-1.9L13.5 5.5v-3M7.5 13h9',
  station: 'M7 2.5h10a1 1 0 011 1v17a1 1 0 01-1 1H7a1 1 0 01-1-1v-17a1 1 0 011-1zM6 13h12M9.5 9.5h5M14.5 5h2v2.5h-2z',
  bin: 'M4 7h16M6 7l1.2 13a1 1 0 001 .9h7.6a1 1 0 001-.9L18 7M9 7V4.5h6V7M10 11v6M14 11v6',
  truck: 'M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5V16h-7M6.5 18.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM17 18.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z',
  route: 'M6 19a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 10a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM8.5 16.5H15a3 3 0 000-6H9a3 3 0 010-6h6.5',
  mapPin: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  map: 'M3 6l6-2.5 6 2.5 6-2.5v14.5l-6 2.5-6-2.5-6 2.5zM9 3.5v14.5M15 6v14.5',
  qr: 'M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6zM14.5 14.5h2.5v2.5h-2.5zM18 18h2.5v2.5H18zM6 6h1v1H6zM17 6h1v1h-1zM6 17h1v1H6z',
  scale: 'M4 20h16M6 20l1.5-9h9L18 20M9 11V8a3 3 0 016 0v3',
  camera: 'M4 8h3l1.5-2.5h7L17 8h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  barcode: 'M4 5v14M7 5v14M10 5v14M14 5v14M16 5v14M20 5v14',
  rollers: 'M8 12a4 4 0 100-8 4 4 0 000 8zM16 12a4 4 0 100-8 4 4 0 000 8zM8 8h0M16 8h0M12 13v8M9 18l3 3 3-3',
  drop: 'M12 3s6 6.5 6 11a6 6 0 01-12 0c0-4.5 6-11 6-11z',
  sensor: 'M12 13a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM8.5 15a5 5 0 010-7M15.5 8a5 5 0 010 7M5.6 17.8a9 9 0 010-12.6M18.4 5.2a9 9 0 010 12.6',
  wrench: 'M14.5 6.5a4 4 0 00-5.3 5.3L3.5 17.5l3 3 5.7-5.7a4 4 0 005.3-5.3l-2.5 2.5-2.6-.5-.5-2.6 2.6-2.4z',
  file: 'M6 2.5h8l4.5 4.5v14.5H6zM14 2.5V7h4.5M9 12h6.5M9 16h6.5',
  fileMissing: 'M6 2.5h8l4.5 4.5v14.5H6zM14 2.5V7h4.5M9.5 12l5 5M14.5 12l-5 5',
  download: 'M12 3.5v12M7 11l5 5 5-5M4.5 20.5h15',
  upload: 'M12 16V4M7 9l5-5 5 5M4.5 20.5h15',
  search: 'M10.5 18a7.5 7.5 0 100-15 7.5 7.5 0 000 15zM16 16l5 5',
  filter: 'M3.5 5h17l-6.5 8v6l-4 1.5V13z',
  calendar: 'M4 5.5h16v15H4zM4 10h16M8.5 3v5M15.5 3v5',
  home: 'M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5M10 20v-5.5h4V20',
  gift: 'M3.5 8.5h17V12h-17zM5 12v8.5h14V12M12 8.5v12M12 8.5S10.5 4 8 4.5 7.5 8.5 12 8.5zM12 8.5s1.5-4.5 4-4 .5 4-4 4z',
  history: 'M4 12a8 8 0 102.3-5.7L4 8.5M4 4v4.5h4.5M12 8v4.5l3 2',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c1-4 4-5.5 7.5-5.5s6.5 1.5 7.5 5.5',
  users: 'M9 11.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20c.8-3.5 3.3-5 6.5-5s5.7 1.5 6.5 5M16 4.6a3.5 3.5 0 010 6.8M18 15.2c1.8.6 3 2.1 3.5 4.8',
  building: 'M4 21V5l8-2.5V21M12 8.5h8V21M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2M2.5 21h19',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 01-2.1 1.2l-.3 2h-4l-.3-2a7 7 0 01-2.1-1.2l-1.9.7-2-3.4 1.6-1.2a7 7 0 010-2.4L4.4 10l2-3.4 1.9.7A7 7 0 0110.4 6l.3-2h4l.3 2a7 7 0 012.1 1.2l1.9-.7 2 3.4-1.6 1.2a7 7 0 010 2.4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  link: 'M10 14a4 4 0 005.7 0l3.5-3.5a4 4 0 00-5.7-5.7L12 6.3M14 10a4 4 0 00-5.7 0l-3.5 3.5a4 4 0 005.7 5.7L12 17.7',
  external: 'M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H4.5V7H10',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
  refresh: 'M20 12a8 8 0 11-2.3-5.7M20 4v5h-5',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  bolt: 'M13 2.5L4.5 13.5H11L10 21.5l8.5-11H12z',
  leaf: 'M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l7-7',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M10 10v4M18 16v4',
  dot: 'M12 12h.01',
  hand: 'M8 13V5.5a1.5 1.5 0 013 0V11M11 10V4a1.5 1.5 0 013 0v6M14 10V5.5a1.5 1.5 0 013 0V13c0 4-2.5 7.5-6.5 7.5S5 18 4.5 15.5l-1-3.5a1.5 1.5 0 012.7-1.2L8 13.5',
  door: 'M5 21V3.5h11V21M16 5h3v16M2.5 21h19M12.5 12.5h.01',
  tray: 'M3 13h5l1.5 3h5L16 13h5M3 13l2.5-8h13L21 13v6.5H3z',
  printer: 'M6.5 9V3.5h11V9M6.5 17H4V10h16v7h-2.5M6.5 14h11v6.5h-11z',
  phone: 'M7 2.5h10a1 1 0 011 1v17a1 1 0 01-1 1H7a1 1 0 01-1-1v-17a1 1 0 011-1zM10.5 18.5h3',
  monitor: 'M3 4.5h18v12H3zM8.5 20.5h7M12 16.5v4',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, strokeWidth = 1.75, className, title, ...rest }: { name: IconName; size?: number; strokeWidth?: number; title?: string } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={`shrink-0 ${className ?? ''}`}
      {...rest}
    >
      {title && <title>{title}</title>}
      <path d={P[name]} />
    </svg>
  );
}

/**
 * RE brand mark: the station's front elevation at true proportion (800 × 1800 mm → 4 : 9),
 * with the intake slot at 1.125 mm and the screen at 1.320 mm above the floor.
 */
export function ReMark({ size = 28, tone = 'forest' }: { size?: number; tone?: 'forest' | 'paper' | 'ink' }) {
  const stroke = tone === 'paper' ? 'rgb(var(--c-paper))' : tone === 'ink' ? 'rgb(var(--c-ink))' : 'rgb(var(--c-forest))';
  const h = size;
  const w = (size * 4) / 9;
  return (
    <svg width={w + 4} height={h} viewBox="-2 0 44 90" aria-hidden className="shrink-0">
      <rect x={1} y={1} width={38} height={88} rx={2} fill="none" stroke={stroke} strokeWidth={4} />
      {/* screen at 1.320 mm */}
      <rect x={22} y={21} width={11} height={9} fill={stroke} />
      {/* intake slot at 1.125 mm, lime accent */}
      <rect x={7} y={34.5} width={13} height={5} rx={1} fill="rgb(var(--c-lime))" />
      {/* storage door seam */}
      <line x1={1} y1={52} x2={39} y2={52} stroke={stroke} strokeWidth={2.5} />
    </svg>
  );
}

export function Wordmark({ tone = 'ink', size = 28, sub }: { tone?: 'ink' | 'paper'; size?: number; sub?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <ReMark size={size} tone={tone === 'paper' ? 'paper' : 'forest'} />
      <span className="flex flex-col leading-none">
        <span className={`text-[19px] font-bold tracking-tight ${tone === 'paper' ? 'text-paper' : 'text-ink'}`}>RE</span>
        {sub && <span className={`mt-0.5 text-[10.5px] font-medium ${tone === 'paper' ? 'text-paper/70' : 'text-muted'}`}>{sub}</span>}
      </span>
    </span>
  );
}
