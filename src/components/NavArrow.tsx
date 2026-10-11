import type { ArrowIcon } from '../domain/nav';

/** Maneuver arrows for the navigation banner, on the same 24 px grid as the icon set. */
const PATH: Record<ArrowIcon, string> = {
  straight: 'M12 21V4.5M6 10.5l6-6 6 6',
  depart: 'M12 21V4.5M6 10.5l6-6 6 6',
  left: 'M17 21v-8a3 3 0 00-3-3H5M10 5L5 10l5 5',
  right: 'M7 21v-8a3 3 0 013-3h9M14 5l5 5-5 5',
  slight_left: 'M15 21v-8L7.5 5.5M7 12V5h7',
  slight_right: 'M9 21v-8l7.5-7.5M17 12V5h-7',
  sharp_left: 'M16 21V5L6 15M6 9v6h6',
  sharp_right: 'M8 21V5l10 10M18 9v6h-6',
  uturn: 'M16 21V9a4 4 0 00-8 0v6M4 11.5l4 4 4-4',
  roundabout: 'M12 21v-5.5M12 15.5a4 4 0 110-8 4 4 0 010 8zM14.8 8.7L19 4.5M14.5 4.5H19V9',
  merge: 'M7 21v-5l5-5V4M17 21v-5l-5-5M8 8l4-4 4 4',
  arrive: 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
};

export function NavArrow({ icon, size = 40, className = '' }: { icon: ArrowIcon; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d={PATH[icon]} />
    </svg>
  );
}
