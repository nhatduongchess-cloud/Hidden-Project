import { lazy, Suspense } from 'react';
import type { RoadMapProps } from './RoadMap';

export type { MapMarker, MapLine, MarkerTone, Padding, RoadMapProps } from './RoadMap';

const Impl = lazy(() => import('./RoadMap'));

/** The road map, loaded on first use so other pages stay light. */
export function RoadMap(props: RoadMapProps) {
  return (
    <Suspense
      fallback={
        <div className={`${/\b(absolute|fixed)\b/.test(props.className ?? '') ? '' : 'relative'} bg-[rgb(232_234_228)] ${props.className ?? ''}`} role="status">
          <span className="absolute inset-0 grid place-items-center text-sm text-muted">Đang tải bản đồ…</span>
        </div>
      }
    >
      <Impl {...props} />
    </Suspense>
  );
}
