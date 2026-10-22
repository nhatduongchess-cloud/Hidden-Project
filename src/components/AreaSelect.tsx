import { AREAS, REGIONS, areaById } from '../domain/areas';
import { useAppState, useStore } from '../lib/store-context';
import { Icon } from './icons';
import { toast } from './ui';

/**
 * Which city the illustrative stations, depot and receiving point are in. Changing it moves all of
 * them at once (and the truck back to the depot), so the map, routes and navigation follow.
 */
export function AreaSelect({ id, label = 'Khu vực dữ liệu mẫu', className = '' }: { id: string; label?: string; className?: string }) {
  const state = useAppState();
  const store = useStore();
  const current = areaById(state.settings.areaId);
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="input appearance-none pr-9"
          value={current.id}
          onChange={(e) => {
            store.dispatch({ type: 'APPLY_AREA', areaId: e.target.value });
            toast(`Đã chuyển dữ liệu trạm tới ${areaById(e.target.value).city}.`);
          }}
        >
          {REGIONS.map((r) => (
            <optgroup key={r} label={r}>
              {AREAS.filter((a) => a.region === r).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.city}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}
