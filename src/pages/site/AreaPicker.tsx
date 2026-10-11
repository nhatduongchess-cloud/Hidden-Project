import { createContext, useContext } from 'react';
import { Icon } from '../../components/icons';
import { Dialog, toast } from '../../components/ui';
import { AREAS, REGIONS, areaById, type ServiceArea } from '../../domain/areas';
import { useAppState, useStore } from '../../lib/store-context';

/** Opens the "Chọn khu vực" dialog from anywhere on the website (header, home cards). */
export const AreaPickerContext = createContext<() => void>(() => {});
export const useOpenAreaPicker = () => useContext(AreaPickerContext);

/**
 * Pick the city the illustrative stations are in, the way a shop asks where to deliver. Choosing a
 * city moves the three demo stations, the depot and the receiving point there at once.
 */
export function AreaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useAppState();
  const store = useStore();
  const current = areaById(state.settings.areaId);
  const pick = (a: ServiceArea) => {
    if (a.id !== current.id) {
      store.dispatch({ type: 'APPLY_AREA', areaId: a.id });
      toast(`Đã chuyển trạm minh họa tới ${a.city}.`);
    }
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Chọn khu vực">
      <p>
        Ba trạm minh họa, bãi xe và điểm tiếp nhận chuyển tới thành phố bạn chọn, để thử bản đồ, tuyến thu gom và dẫn đường ở đó. RE chưa có trạm thật ở thành phố nào.
      </p>
      <div className="-mx-1 mt-3 flex max-h-[52vh] flex-col gap-4 overflow-y-auto px-1 pb-1">
        {REGIONS.map((r) => (
          <section key={r} aria-label={r}>
            <h3 className="text-xs font-semibold uppercase tracking-[0.06em] text-shop-muted">{r}</h3>
            <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
              {AREAS.filter((a) => a.region === r).map((a) => {
                const on = a.id === current.id;
                return (
                  <li key={a.id} className="min-w-0">
                    <button
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => pick(a)}
                      className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border px-3 text-left text-sm text-shop-text ${
                        on ? 'border-shop-cta-2 bg-[#FFF6E5] font-bold' : 'border-shop-line bg-white hover:bg-shop-tile'
                      }`}
                    >
                      <span className="truncate">{a.city}</span>
                      {on && <Icon name="check" size={16} className="shrink-0" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <a href="#driver-map" onClick={onClose} className="shop-link mt-4 inline-block text-[13px] font-medium">
        Xem trạm trên bản đồ tài xế
      </a>
    </Dialog>
  );
}
