import type { Dict } from './vi';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends (...a: never[]) => unknown ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** English dictionary scaffold. Untranslated keys fall back to Vietnamese. */
export const en: DeepPartial<Dict> = {
  nav: { home: 'Overview', station: 'RE station', hub: 'RE Hub', menu: 'Open menu' },
  landing: {
    title: 'Return PET bottles. Earn points. Track the recycling journey.',
    ctaStation: 'Try the RE station',
    ctaHub: 'Open RE Hub',
  },
};
