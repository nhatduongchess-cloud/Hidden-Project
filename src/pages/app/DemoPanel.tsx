import { useAppState, useStore } from '../../lib/store-context';
import type { ItemInput, Material } from '../../domain/types';
import { fillIncrementPct, fillPct } from '../../domain/selectors';
import { runSessionSync } from '../../domain/deposit';
import { Icon } from '../../components/icons';
import { Badge, Button, DemoTag, FillMeter, Segmented, SelectField, Switch, toast } from '../../components/ui';
import { n0 } from '../../lib/format';
import { DEFAULT_ITEM, useAppDemo } from './appContext';

/**
 * Demo controls. Everything here simulates what a real station would sense or what would happen
 * around it. It is visually separate from the app so viewers never mistake it for consumer UI.
 */

const PRESETS: { key: string; label: string; item: ItemInput }[] = [
  { key: 'ok', label: 'Chai PET hợp lệ', item: DEFAULT_ITEM },
  { key: 'colored', label: 'PET màu', item: { ...DEFAULT_ITEM, material: 'PET_COLORED', brand: 'BRAND_B', confidencePct: 88 } },
  { key: 'liquid', label: 'Còn nước', item: { ...DEFAULT_ITEM, liquid: 'excess' } },
  { key: 'can', label: 'Lon kim loại', item: { ...DEFAULT_ITEM, material: 'METAL_CAN', confidencePct: 90 } },
  { key: 'glass', label: 'Chai thủy tinh', item: { ...DEFAULT_ITEM, material: 'GLASS', confidencePct: 91 } },
  { key: 'hdpe', label: 'Chai HDPE', item: { ...DEFAULT_ITEM, material: 'HDPE', confidencePct: 86 } },
  { key: 'unsure', label: 'Không nhận diện được', item: { ...DEFAULT_ITEM, barcode: 'unknown', confidencePct: 55 } },
];

const MATERIALS: { value: Material; label: string }[] = [
  { value: 'PET_CLEAR', label: 'PET trong' },
  { value: 'PET_COLORED', label: 'PET màu' },
  { value: 'HDPE', label: 'HDPE' },
  { value: 'GLASS', label: 'Thủy tinh' },
  { value: 'METAL_CAN', label: 'Lon kim loại' },
  { value: 'UNKNOWN_OBJECT', label: 'Vật lạ' },
];

const sameItem = (a: ItemInput, b: ItemInput) =>
  a.material === b.material && a.liquid === b.liquid && a.barcode === b.barcode && a.brand === b.brand && a.confidencePct === b.confidencePct;

function Group({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section className="border-t border-dashed border-line-strong pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {hint && <p className="mb-2.5 text-xs text-muted">{hint}</p>}
      <div className={hint ? '' : 'mt-2.5'}>{children}</div>
    </section>
  );
}

export function DemoPanel({ embedded }: { embedded?: boolean }) {
  const state = useAppState();
  const store = useStore();
  const { cfg, setCfg, stationId, setStationId, run } = useAppDemo();
  const station = state.stations.find((s) => s.id === stationId) ?? state.stations[0];
  const localFill = fillPct(state, station, 'station');
  const pending = state.transactions.filter((t) => t.stationId === station.id && t.sync === 'pending');
  const busy = run.rs.running;
  const online = station.connection === 'online';

  const setItem = (p: Partial<ItemInput>) => setCfg({ item: { ...cfg.item, ...p } });

  const setOnline = (on: boolean) => {
    const ts = Date.now();
    store.dispatch({ type: 'SET_CONNECTION', stationId: station.id, connection: on ? 'online' : 'offline', ts });
    if (on) {
      // A reconnecting station uploads what it stored locally. The hub ignores ids it already has.
      const recs = store.getState().transactions.filter((t) => t.stationId === station.id && t.sync === 'pending');
      if (recs.length) {
        store.dispatch({ type: 'SYNC_UPLOAD', stationId: station.id, records: recs, ts });
        toast(`${station.id} kết nối lại · đã đồng bộ ${recs.length} giao dịch`);
      } else toast(`${station.id} kết nối lại`);
    } else toast(`${station.id} mất kết nối (mô phỏng)`, 'warn');
  };

  /** Simulate other people using the station until the bin reaches `target` %. */
  const pushFill = (target: number) => {
    const s = store.getState();
    const st = s.stations.find((x) => x.id === station.id)!;
    const cur = fillPct(s, st, 'station');
    const need = Math.ceil((target - cur) / fillIncrementPct(s.settings));
    if (need <= 0) return;
    runSessionSync(store.getState, store.dispatch, { stationId: st.id, userId: 'NV-DEMO-01', item: DEFAULT_ITEM, quantity: need });
    toast(`Đã thêm ${need} chai của người dùng khác vào ${st.id}`, 'info');
  };

  return (
    <div className={embedded ? '' : 'rounded-lg border-2 border-dashed border-line-strong bg-panel p-4'}>
      {!embedded && (
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon name="sliders" size={16} />
              Bảng điều khiển demo
            </h2>
            <p className="mt-0.5 text-xs text-muted">Mô phỏng cảm biến và sự cố. Không thuộc ứng dụng thật.</p>
          </div>
          <DemoTag>Mô phỏng</DemoTag>
        </div>
      )}
      {embedded && <p className="mb-4 text-xs text-muted">Mô phỏng cảm biến và sự cố. Không thuộc ứng dụng thật.</p>}

      <div className="flex flex-col gap-4">
        <Group title="Người dùng và trạm">
          <div className="grid gap-3">
            <SelectField
              id="demo-user"
              label="Người dùng demo đang đăng nhập"
              value={state.currentUserId}
              onChange={(v) => store.dispatch({ type: 'SET_CURRENT_USER', userId: v })}
              options={state.users.map((u) => ({ value: u.id, label: `${u.label} (${u.id})` }))}
              disabled={busy}
            />
            <SelectField
              id="demo-station"
              label="Trạm người dùng đang đứng"
              value={station.id}
              onChange={setStationId}
              options={state.stations.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))}
              disabled={busy}
            />
          </div>
        </Group>

        <Group title="Chai tiếp theo" hint="Chọn vật phẩm người dùng sẽ đặt vào khe.">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Vật phẩm mẫu">
            {PRESETS.map((p) => {
              const on = sameItem(cfg.item, p.item);
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCfg({ item: p.item })}
                  className={`min-h-[36px] rounded-sm border px-2.5 text-xs font-medium transition-colors ${on ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-white text-ink-2 hover:border-ink'}`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <details className="group mt-3">
            <summary className="flex min-h-[36px] cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
              <Icon name="chevronRight" size={14} className="transition-transform group-open:rotate-90" />
              Chỉnh tín hiệu cảm biến
            </summary>
            <div className="mt-2 grid gap-3">
              <SelectField id="demo-mat" label="Vật liệu camera thấy" value={cfg.item.material} onChange={(v) => setItem({ material: v })} options={MATERIALS} />
              <Segmented
                label="Chất lỏng (theo cân)"
                name="demo-liquid"
                size="sm"
                value={cfg.item.liquid}
                onChange={(v) => setItem({ liquid: v })}
                options={[
                  { value: 'empty', label: 'Đã đổ hết' },
                  { value: 'excess', label: 'Còn nước' },
                ]}
              />
              <Segmented
                label="Mã vạch"
                name="demo-barcode"
                size="sm"
                value={cfg.item.barcode}
                onChange={(v) => setItem({ barcode: v })}
                options={[
                  { value: 'recognized', label: 'Có trong danh mục' },
                  { value: 'unknown', label: 'Không đọc được' },
                ]}
              />
              <SelectField
                id="demo-brand"
                label="Thương hiệu theo mã vạch"
                value={cfg.item.brand}
                onChange={(v) => setItem({ brand: v })}
                options={[
                  { value: 'BRAND_A', label: 'Thương hiệu A (minh họa)' },
                  { value: 'BRAND_B', label: 'Thương hiệu B (minh họa)' },
                  { value: 'BRAND_C', label: 'Thương hiệu C (minh họa)' },
                ]}
                disabled={cfg.item.barcode !== 'recognized'}
              />
              <div>
                <label htmlFor="demo-conf" className="field-label flex justify-between">
                  Độ tin cậy camera <span className="tnum font-semibold text-ink">{cfg.item.confidencePct} %</span>
                </label>
                <input
                  id="demo-conf"
                  type="range"
                  min={0}
                  max={100}
                  value={cfg.item.confidencePct}
                  onChange={(e) => setItem({ confidencePct: Number(e.target.value) })}
                  className="w-full accent-[rgb(var(--c-forest))]"
                />
                <p className="mt-1 text-xs text-muted">Ngưỡng {state.settings.confidenceThresholdPct} %; mã vạch trong danh mục hạ ngưỡng 20 điểm.</p>
              </div>
            </div>
          </details>
          <div className="mt-3">
            <Switch id="demo-jam" label="Gây kẹt rulo ở chai tiếp theo" checked={cfg.injectNext === 'jam'} onChange={(v) => setCfg({ injectNext: v ? 'jam' : 'none' })} />
          </div>
        </Group>

        <Group title={`Trạng thái ${station.id}`}>
          <div className="flex flex-col gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>Mức đầy tại trạm</span>
                {station.fault ? (
                  <Badge tone="fault" icon="stop">
                    {station.fault === 'jam' ? 'Kẹt rulo' : 'Dừng khẩn cấp'}
                  </Badge>
                ) : null}
              </div>
              <FillMeter pct={localFill} warn={state.settings.warnPct} stop={state.settings.stopPct} label={`Mức đầy ${station.id} tại trạm`} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => pushFill(Math.min(100, localFill + 10 * fillIncrementPct(state.settings)))} disabled={busy || !!station.fault || localFill >= state.settings.stopPct}>
                +10 chai
              </Button>
              <Button size="sm" onClick={() => pushFill(state.settings.warnPct)} disabled={busy || !!station.fault || localFill >= state.settings.warnPct}>
                Đến {state.settings.warnPct} %
              </Button>
              <Button size="sm" onClick={() => pushFill(state.settings.stopPct)} disabled={busy || !!station.fault || localFill >= state.settings.stopPct}>
                Làm đầy {state.settings.stopPct} %
              </Button>
            </div>
            <Switch
              id="demo-conn"
              label="Kết nối 4G với RE Hub"
              hint={online ? 'Tắt để mô phỏng mất mạng. Trạm vẫn nhận chai và lưu tại chỗ.' : `${pending.length} giao dịch đang lưu tại trạm. Bật lại để đồng bộ.`}
              checked={online}
              onChange={setOnline}
              disabled={busy}
            />
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="danger" icon="stop" onClick={() => run.emergencyStop(station.id)} disabled={station.fault === 'estop'}>
                Nhấn dừng khẩn cấp
              </Button>
              {station.fault && (
                <Button
                  size="sm"
                  icon="wrench"
                  onClick={() => {
                    store.dispatch({ type: 'CLEAR_FAULT', stationId: station.id, ts: Date.now() });
                    run.reset();
                    toast(`Kỹ thuật viên đã đặt lại ${station.id}`);
                  }}
                >
                  Kỹ thuật viên đặt lại trạm
                </Button>
              )}
            </div>
            <a href={`#hub-station-${station.id}`} className="link inline-flex items-center gap-1 text-sm">
              Xem {station.id} trong RE Hub <Icon name="arrowRight" size={14} />
            </a>
          </div>
        </Group>

        <Group title="Tốc độ hoạt ảnh">
          <Segmented
            label="Tốc độ"
            hideLabel
            name="demo-speed"
            size="sm"
            value={cfg.speed}
            onChange={(v) => setCfg({ speed: v })}
            options={[
              { value: 'normal', label: 'Bình thường' },
              { value: 'fast', label: 'Nhanh' },
            ]}
          />
          <p className="mt-2 text-xs text-muted">
            Mỗi chai hợp lệ +{n0(state.settings.pointsPerBottle)} điểm (minh họa). Điểm chỉ được ghi sau khi cảm biến xác nhận chai đã rơi vào thùng.
          </p>
        </Group>
      </div>
    </div>
  );
}
