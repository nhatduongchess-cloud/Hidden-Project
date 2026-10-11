import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useAppState, useStore } from '../../lib/store-context';
import { activeRoute, stationOps } from '../../domain/ops';
import { DEPOT, PARTNER, fmtMin, toMin, type RouteEval } from '../../domain/routing';
import { defaultDispatchConfig, planFor, toAssignedRoute, type DispatchConfig } from '../../domain/dispatch';
import type { AssignedRoute } from '../../domain/types';
import { kg, n0, n1 } from '../../lib/format';
import { Icon } from '../../components/icons';
import { Alert, Badge, Button, DemoTag, Dialog, Disclosure, NumberField, Segmented, Switch, toast } from '../../components/ui';
import { STOP_CLASS } from '../driver/Driver';
import { PageHeader, Panel } from './shared';
import { RouteRoadMap } from './RouteRoadMap';
import { useRoadMetric } from '../../lib/roadHooks';
import { ProviderNote } from '../driver/shared';

function Capacity({ label, used, max, unit }: { label: string; used: number; max: number; unit: string }) {
  const p = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const over = used > max + 1e-9;
  return (
    <div className="min-w-0">
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={`tnum font-semibold ${over ? 'text-fault-ink' : 'text-ink'}`}>
          {unit === 'kg' ? n0(used) : n0(used)} / {n0(max)} {unit}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-sm bg-sunk" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={used} aria-label={label}>
        <div className={`h-full ${over ? 'bg-fault' : 'bg-forest'}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function ActiveRoute({ route }: { route: AssignedRoute }) {
  const state = useAppState();
  const store = useStore();
  const [cancel, setCancel] = useState(false);
  const done = route.stops.filter((s) => s.status === 'done').length;
  return (
    <Panel
      title={
        <span className="flex flex-wrap items-center gap-2">
          Tuyến đang giao <span className="id-tag">{route.id}</span>
          {route.status === 'assigned' ? (
            <Badge tone="info" icon="clock">
              Chờ tài xế bắt đầu
            </Badge>
          ) : (
            <Badge tone="forest" icon="truck">
              Đang chạy · {done}/{route.stops.length}
            </Badge>
          )}
        </span>
      }
      actions={<DemoTag>Tuyến minh họa</DemoTag>}
      className="mb-5"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="text-sm text-ink-2">
            {route.driver} · xuất phát {route.departure} · {n1(route.distanceKm)} km · {n0(route.durationMin)} phút · kết thúc tại {route.endAt === PARTNER ? 'đối tác tiếp nhận' : 'kho RE'}
          </div>
          <ol className="mt-3 flex flex-col gap-2">
            {route.stops.map((s, i) => {
              const st = state.stations.find((x) => x.id === s.stationId)!;
              const c = STOP_CLASS[s.cls];
              return (
                <li key={s.stationId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded border border-line bg-white px-3 py-2">
                  <span className={`tnum grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${s.status === 'done' ? 'bg-forest text-white' : s.status === 'skipped' ? 'bg-sunk text-muted' : 'border border-line-strong text-ink'}`}>
                    {s.status === 'done' ? <Icon name="check" size={13} strokeWidth={2.6} /> : i + 1}
                  </span>
                  <span className="id-tag font-semibold text-ink">{st.id}</span>
                  <span className="text-sm text-muted">{st.name}</span>
                  <Badge tone={c.tone} icon={c.icon}>
                    {c.label}
                  </Badge>
                  <span className="ml-auto text-xs text-ink-2">
                    {s.status === 'done' ? 'Đã thay thùng' : s.status === 'skipped' ? `Bỏ qua: ${s.skipReason}` : `Dự kiến ${fmtMin(s.etaMin)}`}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="#driver" className="btn btn-primary btn-sm">
              <Icon name="phone" size={16} /> Mở màn hình tài xế
            </a>
            {route.status === 'assigned' && (
              <Button size="sm" variant="ghost" onClick={() => setCancel(true)}>
                Hủy tuyến
              </Button>
            )}
          </div>
        </div>
        <RouteRoadMap
          order={[DEPOT, ...route.stops.filter((s) => s.status === 'pending' || route.status === 'assigned').map((s) => s.stationId), route.endAt]}
          label={`Bản đồ tuyến ${route.id}`}
          truck={route.status === 'in_progress' ? (state.driverPos ?? state.settings.depot) : null}
          className="h-[300px]"
        />
      </div>
      <Dialog
        open={cancel}
        onClose={() => setCancel(false)}
        title={`Hủy tuyến ${route.id}?`}
        footer={
          <>
            <Button onClick={() => setCancel(false)}>Giữ tuyến</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.dispatch({ type: 'CANCEL_ROUTE', routeId: route.id, ts: Date.now() });
                setCancel(false);
                toast(`Đã hủy ${route.id}. Yêu cầu thu gom quay về danh sách chờ.`, 'info');
              }}
            >
              Hủy tuyến
            </Button>
          </>
        }
      >
        Tài xế chưa bắt đầu. Các yêu cầu thu gom trên tuyến sẽ quay lại trạng thái chờ xếp tuyến.
      </Dialog>
    </Panel>
  );
}

function Compare({ planned, baseline, byTime }: { planned: RouteEval; baseline: RouteEval; byTime: boolean }) {
  // With road data the planner minimises driving time, so that is what the comparison reports.
  const a = byTime ? planned.durationMin : planned.distanceKm;
  const b = byTime ? baseline.durationMin : baseline.distanceKm;
  const diff = b > 0 ? ((b - a) / b) * 100 : 0;
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {[
        ['Tuyến đề xuất', planned, 'border-forest/40 bg-forest-tint/50'],
        ['Thứ tự cố định (đối chứng)', baseline, 'border-line bg-panel'],
      ].map(([l, e, c]) => {
        const ev = e as RouteEval;
        return (
          <div key={l as string} className={`min-w-0 rounded border p-3 ${c}`}>
            <div className="text-xs font-semibold text-ink-2">{l as string}</div>
            <div className="mt-1 break-words font-mono text-[11.5px] text-ink">{['Kho', ...ev.order, 'Đích'].join(' → ')}</div>
            <div className="tnum mt-1.5 font-semibold text-ink">
              {n1(ev.distanceKm)} km · {n0(ev.durationMin)} phút
            </div>
            {ev.violations.length > 0 && <div className="mt-0.5 text-xs text-fault-ink">{ev.violations.length} vi phạm ràng buộc</div>}
          </div>
        );
      })}
      <p className="col-span-2 text-xs text-muted">
        {Math.abs(diff) < 0.05
          ? `Cùng ${byTime ? 'thời gian lái xe' : 'quãng đường'} với thứ tự cố định cho các điểm dừng này.`
          : diff > 0
            ? `${byTime ? 'Nhanh hơn' : 'Ngắn hơn'} ${n1(diff)} % so với đi theo thứ tự mã trạm.`
            : `${byTime ? 'Chậm hơn' : 'Dài hơn'} thứ tự cố định vì ưu tiên khung giờ trạm.`}
      </p>
    </div>
  );
}

export function Routes() {
  const t = useT();
  const r = t.hub.routes;
  const state = useAppState();
  const store = useStore();
  const [cfg, setCfg] = useState<DispatchConfig>(() => defaultDispatchConfig(state));
  const set = <K extends keyof DispatchConfig>(k: K, v: DispatchConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const route = activeRoute(state);
  const running = route?.status === 'in_progress';
  const road = useRoadMetric(state);
  const plan = useMemo(() => planFor(state, cfg, road.metric), [state, cfg, road.metric]);
  const maxBins = Math.floor((cfg.cargoVolumeM3 + 1e-9) / cfg.binVolumeM3);
  const selected = new Set(plan.selected);
  const unserved = plan.candidates.filter((c) => !selected.has(c.id));
  const staleStops = plan.selected.filter((id) => stationOps(state, state.stations.find((s) => s.id === id)!).stale);
  const issueText = (v: string) => {
    const [k, id] = v.split(':');
    return r.issues[k]?.(id) ?? v;
  };

  const assign = () => {
    const ar = toAssignedRoute(state, plan, cfg, Date.now());
    if (!ar) return;
    store.dispatch({ type: 'ASSIGN_ROUTE', route: ar, ts: Date.now() });
    toast(`Đã giao ${ar.id} cho ${ar.driver} · ${ar.stops.length} điểm dừng`);
    document.getElementById('main')?.scrollIntoView({ block: 'start' });
  };

  const config = (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <NumberField id="rt-payload" label="Tải trọng xe" unit="kg" value={cfg.payloadKg} min={0} max={5000} step={1} onChange={(v) => set('payloadKg', v)} />
        <NumberField id="rt-volume" label="Thể tích thùng xe" unit="m³" value={cfg.cargoVolumeM3} min={0} max={20} step={0.01} onChange={(v) => set('cargoVolumeM3', v)} hint={`Chở được ${maxBins} thùng 0,24 m³`} />
        <div className="min-w-0">
          <label htmlFor="rt-dep" className="field-label">
            Giờ xuất phát
          </label>
          <input id="rt-dep" type="time" className="input tnum" value={cfg.departure} onChange={(e) => e.target.value && set('departure', e.target.value)} />
        </div>
        <div className="min-w-0">
          <label htmlFor="rt-end" className="field-label">
            Kết thúc ca
          </label>
          <input id="rt-end" type="time" className="input tnum" value={cfg.shiftEnd} onChange={(e) => e.target.value && set('shiftEnd', e.target.value)} />
        </div>
        <NumberField id="rt-service" label="Phục vụ mỗi trạm" unit="phút" value={cfg.serviceMin} min={0} max={120} step={1} onChange={(v) => set('serviceMin', v)} />
        <NumberField
          id="rt-speed"
          label="Tốc độ trung bình"
          unit="km/h"
          value={cfg.speedKmh}
          min={1}
          max={80}
          step={1}
          onChange={(v) => set('speedKmh', v)}
          hint={plan.metric === 'road' ? 'Không dùng: thời gian lấy từ dữ liệu đường' : 'Dùng khi chưa có dữ liệu đường'}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
        <NumberField id="rt-thr" label="Ngưỡng thu gom" unit="%" value={cfg.thresholdPct} min={1} max={95} step={1} onChange={(v) => set('thresholdPct', v)} />
        <NumberField id="rt-next" label="Chuyến kế tiếp sau" unit="giờ" value={cfg.nextHours} min={0} max={72} step={1} onChange={(v) => set('nextHours', v)} />
      </div>
      <Switch id="rt-nearby" label="Ghé thêm trạm gần" hint="Nếu xe còn tải và còn giờ" checked={cfg.includeNearby} onChange={(v) => set('includeNearby', v)} />
      {cfg.includeNearby && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField id="rt-nearmin" label="Mức tối thiểu" unit="%" value={cfg.nearbyMinPct} min={0} max={95} step={1} onChange={(v) => set('nearbyMinPct', v)} />
          <NumberField id="rt-detour" label="Đi vòng tối đa" unit="km" value={cfg.maxDetourKm} min={0} max={50} step={0.1} onChange={(v) => set('maxDetourKm', v)} />
        </div>
      )}
      <Segmented
        name="rt-endat"
        label="Điểm kết thúc"
        value={cfg.endAt}
        onChange={(v) => set('endAt', v)}
        options={[
          { value: PARTNER, label: 'Đối tác tiếp nhận' },
          { value: DEPOT, label: 'Kho RE' },
        ]}
      />
      <p className="text-xs text-muted">{r.forecastNote(cfg.nextHours)} Khung giờ vào trạm sửa trong Cài đặt.</p>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Tuyến thu gom"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            Lập và giao tuyến cho tài xế <DemoTag>Tuyến minh họa</DemoTag>
          </span>
        }
      />

      {route && <ActiveRoute route={route} />}

      {running ? (
        <Alert tone="info" title="Tài xế đang chạy tuyến">
          Lập tuyến mới sau khi {route!.id} kết thúc. Trạm bị bỏ qua sẽ quay lại danh sách cần xử lý.
        </Alert>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="hidden xl:block">
              <Panel title="Xe, ca và quy tắc">{config}</Panel>
            </div>
            <div className="xl:hidden">
              <Disclosure summary="Xe, ca và quy tắc chọn trạm">{config}</Disclosure>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            {plan.planned ? (
              <Alert
                tone={plan.feasible ? 'success' : 'warn'}
                title={plan.feasible ? `Tuyến khả thi · ${plan.selected.length} điểm dừng` : 'Tuyến có xung đột cần xem lại'}
                live
              >
                {plan.feasible ? (
                  `Về ${cfg.endAt === PARTNER ? 'đối tác tiếp nhận' : 'kho RE'} lúc ${fmtMin(plan.planned.finishMin)}, trước giờ kết thúc ca ${cfg.shiftEnd}.`
                ) : (
                  <ul className="mt-0.5 list-disc pl-4">
                    {plan.issues.map((v) => (
                      <li key={v}>{issueText(v)}</li>
                    ))}
                  </ul>
                )}
              </Alert>
            ) : (
              <Alert tone="info" title="Không có trạm cần thu gom" live>
                {plan.issues.filter((i) => i !== 'no_stops').map(issueText).join(' ') || 'Không trạm nào đạt ngưỡng hoặc dự báo đạt ngưỡng trước chuyến kế tiếp.'}
              </Alert>
            )}

            {plan.planned && plan.baseline && (
              <>
                <Panel title="Tuyến đề xuất" actions={<DemoTag>Tuyến minh họa</DemoTag>}>
                  <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="min-w-0">
                      <div className="mb-3">
                        <ProviderNote provider={road.provider} loading={road.loading} />
                        {road.provider === 'estimate' && !road.loading && <p className="mt-0.5 text-xs text-muted">Không kết nối được dịch vụ định tuyến. Tuyến được xếp theo đường thẳng × 1,35 ở tốc độ trung bình.</p>}
                      </div>
                      <dl className="grid grid-cols-3 gap-3">
                        <div>
                          <dt className="text-xs text-muted">Quãng đường</dt>
                          <dd className="tnum text-lg font-semibold text-ink">{n1(plan.planned.distanceKm)} km</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Thời gian</dt>
                          <dd className="tnum text-lg font-semibold text-ink">{n0(plan.planned.durationMin)} phút</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted">Về đích</dt>
                          <dd className={`tnum text-lg font-semibold ${plan.planned.finishMin > toMin(cfg.shiftEnd) ? 'text-fault-ink' : 'text-ink'}`}>{fmtMin(plan.planned.finishMin)}</dd>
                        </div>
                      </dl>
                      <div className="mt-4 grid gap-3">
                        <Capacity label="Tải trọng (ước tính)" used={plan.planned.collectedKg} max={cfg.payloadKg} unit="kg" />
                        <Capacity label="Thùng trên xe" used={plan.selected.length} max={maxBins} unit="thùng" />
                      </div>
                      <ol className="mt-5 flex flex-col">
                        <li className="flex items-center gap-3 pb-2 text-sm text-muted">
                          <span className="grid h-6 w-6 place-items-center rounded-sm bg-ink text-paper">
                            <Icon name="building" size={13} />
                          </span>
                          Kho RE · xuất phát {cfg.departure}
                        </li>
                        {plan.planned.stops.map((s, i) => {
                          const cand = plan.candidates.find((c) => c.id === s.id)!;
                          const c = STOP_CLASS[cand.cls === 'skipped' ? 'optional' : cand.cls];
                          const st = state.stations.find((x) => x.id === s.id)!;
                          const stale = staleStops.includes(s.id);
                          return (
                            <li key={s.id} className={`flex gap-3 border-l-2 py-2.5 pl-3 ml-3 ${s.late ? 'border-fault' : 'border-forest/50'}`}>
                              <span className="tnum -ml-[27px] grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest text-xs font-bold text-white">{i + 1}</span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <a href={`#hub-station-${s.id}`} className="id-tag font-semibold text-ink hover:underline">
                                    {s.id}
                                  </a>
                                  <Badge tone={c.tone} icon={c.icon}>
                                    {c.label}
                                  </Badge>
                                  <span className="tnum text-xs text-muted">
                                    {Math.round(cand.st.currentPct)} % · {r.reasons[cand.reason] ?? cand.reason}
                                  </span>
                                </div>
                                <div className="tnum mt-0.5 text-xs text-ink-2">
                                  Đến {fmtMin(s.arriveMin)}
                                  {s.waitMin > 0 && ` · chờ ${n0(s.waitMin)} phút`} · mở {st.accessWindow.start}–{st.accessWindow.end} · ≈ {kg(s.massKg, 1)}
                                </div>
                                {s.late && <div className="mt-0.5 text-xs font-medium text-fault-ink">Đến sau giờ đóng cửa trạm</div>}
                                {stale && <div className="mt-0.5 text-xs text-slate">Mất kết nối: mức đầy là lần đọc cuối, thực tế có thể cao hơn</div>}
                              </div>
                            </li>
                          );
                        })}
                        <li className="flex items-center gap-3 pt-2 text-sm text-muted">
                          <span className="grid h-6 w-6 place-items-center rounded-sm bg-ink text-paper">
                            <Icon name="flag" size={13} />
                          </span>
                          {cfg.endAt === PARTNER ? 'Đối tác tiếp nhận (minh họa)' : 'Kho RE (minh họa)'} · {fmtMin(plan.planned.finishMin)}
                        </li>
                      </ol>
                    </div>
                    <div className="min-w-0">
                      <RouteRoadMap order={[DEPOT, ...plan.planned.order, cfg.endAt]} baseline={[DEPOT, ...plan.baseline.order, cfg.endAt]} label="Bản đồ tuyến đề xuất và tuyến đối chứng" showProvider={false} />
                      <p className="mt-2 text-xs text-muted">{r.disclaimers[plan.metric]}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    <Button variant="primary" icon="truck" onClick={assign}>
                      {route?.status === 'assigned' ? `Thay ${route.id} bằng tuyến này` : 'Giao tuyến cho tài xế'}
                    </Button>
                    <span className="text-xs text-muted">Tài xế nhận tuyến trên điện thoại và xác nhận từng lần thay thùng.</span>
                  </div>
                </Panel>

                <div className="grid gap-5 lg:grid-cols-2">
                  <Panel title="Trạm không có trong tuyến">
                    {unserved.length === 0 ? (
                      <p className="text-sm text-muted">Mọi trạm đều được ghé.</p>
                    ) : (
                      <ul className="flex flex-col gap-2.5">
                        {unserved.map((c) => {
                          const dropped = plan.issues.some((i) => i.endsWith(`:${c.id}`) && i.includes('_required'));
                          return (
                            <li key={c.id} className="flex items-start gap-2.5 text-sm">
                              <Icon name={dropped ? 'alert' : 'minus'} size={16} className={`mt-0.5 ${dropped ? 'text-fault-ink' : 'text-muted'}`} />
                              <div>
                                <span className="id-tag font-semibold text-ink">{c.id}</span> <span className="tnum text-muted">{Math.round(c.st.currentPct)} %</span>
                                <div className={`text-xs ${dropped ? 'font-medium text-fault-ink' : 'text-ink-2'}`}>
                                  {dropped ? issueText(plan.issues.find((i) => i.endsWith(`:${c.id}`))!) : (r.reasons[c.reason] ?? c.reason)}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </Panel>
                  <Panel title="So với thứ tự cố định">
                    <Compare planned={plan.planned} baseline={plan.baseline} byTime={plan.metric !== 'mock'} />
                  </Panel>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
