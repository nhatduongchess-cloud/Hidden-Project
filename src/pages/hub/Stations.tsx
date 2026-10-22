import { useMemo, useState } from 'react';
import { useAppState } from '../../lib/store-context';
import { allStationOps, attentionItems, stationOps, type StationOps } from '../../domain/ops';
import { lifetimeByStation } from '../../domain/selectors';
import { binCapacityKg } from '../../domain/constants';
import type { WorkOrder } from '../../domain/types';
import { ago, dateTime, hours, kg, n0, n1 } from '../../lib/format';
import { useT } from '../../i18n';
import { Icon } from '../../components/icons';
import { Button, ConnBadge, DemoTag, EmptyState, EstimateTag, FillMeter, OpBadge, StaleTag, Tabs } from '../../components/ui';
import { AttentionRow } from './Overview';
import { MaintenanceDialog, PageHeader, Panel, REASON_LABEL, ResolveDialog, ScheduleCollectionDialog, logText, logTone, taskStatusText } from './shared';

function openTasks(tasks: WorkOrder[], id: string) {
  return tasks.filter((t) => t.stationId === id && t.status !== 'done');
}

function ReadingTime({ o }: { o: StationOps }) {
  return o.stale ? (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <StaleTag>lần cuối {dateTime(o.lastReadingTs).slice(6)}</StaleTag>
      <span className="text-xs text-muted">{ago(o.lastReadingTs)}</span>
    </span>
  ) : (
    <span className="text-sm text-ink-2">{ago(o.lastReadingTs)}</span>
  );
}

export function StationsList() {
  const state = useAppState();
  const [tab, setTab] = useState<'all' | 'attention' | 'ok'>('all');
  const ops = allStationOps(state);
  const attn = new Set(attentionItems(state).filter((i) => i.kind !== 'forecast').map((i) => i.stationId));
  const rows = ops.filter((o) => (tab === 'all' ? true : tab === 'attention' ? attn.has(o.station.id) : !attn.has(o.station.id)));

  return (
    <>
      <PageHeader
        title="Trạm thu gom"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            {state.stations.length} trạm · số liệu RE Hub đã nhận <DemoTag />
          </span>
        }
      />
      <Tabs
        label="Lọc trạm"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: 'Tất cả', count: ops.length },
          { value: 'attention', label: 'Cần xử lý', count: attn.size },
          { value: 'ok', label: 'Bình thường', count: ops.length - attn.size },
        ]}
      />
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="checkCircle" title="Không có trạm trong nhóm này" />
        </div>
      ) : (
        <>
          <div className="card mt-4 hidden overflow-x-auto xl:block">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Trạm</th>
                  <th>Vận hành</th>
                  <th>Kết nối</th>
                  <th className="min-w-[180px]">Mức đầy</th>
                  <th>Lần đọc cuối</th>
                  <th>
                    Đến 95 % <span className="font-normal normal-case">(ước tính)</span>
                  </th>
                  <th>Việc đang mở</th>
                  <th>
                    <span className="sr-only">Mở</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const tasks = openTasks(state.tasks, o.station.id);
                  return (
                    <tr key={o.station.id} className="cursor-pointer hover:bg-sunk/50" onClick={() => (location.hash = `hub-station-${o.station.id}`)}>
                      <td>
                        <a href={`#hub-station-${o.station.id}`} className="id-tag whitespace-nowrap font-semibold text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                          {o.station.id}
                        </a>
                        <div className="text-xs text-muted">{o.station.name}</div>
                      </td>
                      <td>
                        <OpBadge op={o.op} stale={o.stale} short />
                      </td>
                      <td>
                        <ConnBadge online={o.conn === 'online'} minutes={o.conn === 'offline' ? o.minutesSinceReading : undefined} />
                      </td>
                      <td>
                        <FillMeter pct={o.hubFillPct} stale={o.stale} size="sm" label={`Mức đầy ${o.station.id}`} />
                      </td>
                      <td>
                        <ReadingTime o={o} />
                      </td>
                      <td className="tnum text-sm">{o.op === 'jam' || o.op === 'estop' ? '—' : hours(o.hoursTo95)}</td>
                      <td className="text-xs text-ink-2">
                        {tasks.length === 0
                          ? '—'
                          : tasks.map((t) => (
                              <div key={t.id}>
                                <span className="id-tag">{t.id}</span> {t.kind === 'collection' ? 'thu gom' : 'bảo trì'}
                              </div>
                            ))}
                      </td>
                      <td>
                        <Icon name="chevronRight" size={16} className="text-muted" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:hidden">
            {rows.map((o) => (
              <li key={o.station.id}>
                <a href={`#hub-station-${o.station.id}`} className="card flex h-full flex-col gap-2.5 p-4 hover:border-line-strong">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="id-tag font-semibold text-ink">{o.station.id}</div>
                      <div className="text-sm text-muted">{o.station.name}</div>
                    </div>
                    <Icon name="chevronRight" size={18} className="mt-1 text-muted" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <OpBadge op={o.op} stale={o.stale} short />
                    <ConnBadge online={o.conn === 'online'} minutes={o.conn === 'offline' ? o.minutesSinceReading : undefined} />
                  </div>
                  <FillMeter pct={o.hubFillPct} stale={o.stale} label={`Mức đầy ${o.station.id}`} />
                  <dl className="grid grid-cols-2 gap-2 border-t border-line pt-2.5 text-sm">
                    <div>
                      <dt className="text-xs text-muted">Lần đọc cuối</dt>
                      <dd>
                        <ReadingTime o={o} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Đến 95 % (ước tính)</dt>
                      <dd className="tnum text-ink-2">{o.op === 'jam' || o.op === 'estop' ? '—' : hours(o.hoursTo95)}</dd>
                    </div>
                  </dl>
                  {openTasks(state.tasks, o.station.id).map((t) => (
                    <div key={t.id} className="flex items-center gap-1.5 text-xs text-ink-2">
                      <Icon name={t.kind === 'collection' ? 'truck' : 'wrench'} size={13} className="text-muted" />
                      <span className="id-tag">{t.id}</span> {taskStatusText(state, t)}
                    </div>
                  ))}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-xs text-muted">Trạng thái vận hành và kết nối hiển thị riêng. Trạm mất kết nối giữ số đo cuối, đánh dấu “lần cuối”.</p>
    </>
  );
}

/** Vertical bin gauge with the 80 % and 95 % lines. Stale readings are hatched. */
function BinGauge({ pct, warn, stop, stale }: { pct: number; warn: number; stop: number; stale: boolean }) {
  const H = 150;
  const p = Math.max(0, Math.min(100, pct));
  const y = (v: number) => 6 + (H - 12) * (1 - v / 100);
  const fill = stale ? 'rgb(var(--c-slate) / 0.55)' : p >= stop ? 'rgb(var(--c-fault))' : p >= warn ? 'rgb(var(--c-amber))' : 'rgb(var(--c-forest))';
  return (
    <svg viewBox={`0 0 104 ${H}`} className="h-[150px] w-[104px] shrink-0" role="img" aria-label={`Mức đầy thùng ${Math.round(p)} %${stale ? ', số đo cũ' : ''}`}>
      <defs>
        <pattern id="gauge-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={fill} />
          <line x1="0" y1="0" x2="0" y2="6" stroke="rgb(var(--c-panel))" strokeWidth="2" />
        </pattern>
      </defs>
      <rect x="8" y="6" width="56" height={H - 12} rx="3" fill="rgb(var(--c-sunk))" stroke="rgb(var(--c-line-strong))" />
      <rect x="10" y={y(p)} width="52" height={Math.max(0, y(0) - y(p))} rx="2" fill={stale ? 'url(#gauge-hatch)' : fill} />
      {[
        [stop, 'rgb(var(--c-fault-ink))', `${stop} %`],
        [warn, 'rgb(var(--c-amber-ink))', `${warn} %`],
      ].map(([v, c, l]) => (
        <g key={String(l)}>
          <line x1="4" x2="68" y1={y(v as number)} y2={y(v as number)} stroke={c as string} strokeWidth="1.5" strokeDasharray="3 2" />
          <text x="72" y={y(v as number) + 3.5} fontSize="10" fill={c as string} fontFamily="Source Sans 3 Variable, sans-serif">
            {l}
          </text>
        </g>
      ))}
    </svg>
  );
}

function TaskItem({ t }: { t: WorkOrder }) {
  const state = useAppState();
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Icon name={t.kind === 'collection' ? 'truck' : 'wrench'} size={15} className="text-muted" />
          <span className="id-tag font-semibold text-ink">{t.id}</span>
          <span className="text-ink">{t.kind === 'collection' ? 'Thu gom' : 'Bảo trì'}</span>
          <span className="text-muted">· {REASON_LABEL[t.reason]}</span>
        </div>
        <div className="mt-0.5 text-xs text-ink-2">{taskStatusText(state, t)}</div>
        {t.resolution && t.status === 'done' && <div className="mt-0.5 text-xs text-muted">{t.resolution.startsWith('bin_swapped') ? 'Tài xế xác nhận thay thùng' : t.resolution}</div>}
        {t.note && <div className="mt-0.5 text-xs text-muted">Ghi chú: {t.note}</div>}
      </div>
      {t.kind === 'maintenance' && t.status !== 'done' && (
        <>
          <Button size="sm" icon="check" onClick={() => setOpen(true)}>
            Xác nhận đã xử lý
          </Button>
          {open && <ResolveDialog task={t} open onClose={() => setOpen(false)} />}
        </>
      )}
      {t.kind === 'collection' && t.status !== 'done' && (
        <a href="#hub-routes" className="btn btn-ghost btn-sm">
          {t.routeId ? 'Xem tuyến' : 'Lập tuyến'}
        </a>
      )}
    </li>
  );
}

export function StationDetail({ id }: { id: string }) {
  const state = useAppState();
  const t = useT();
  const [dlg, setDlg] = useState<null | 'collect' | 'maint'>(null);
  const st = state.stations.find((s) => s.id === id);
  const now = Date.now();
  const o = st ? stationOps(state, st, now) : null;
  const item = attentionItems(state, now).find((i) => i.stationId === id);
  const life = st ? lifetimeByStation(state, st.id) : null;

  const today = useMemo(() => {
    if (!st) return { reasons: [] as [string, number][] };
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const m = new Map<string, number>();
    for (const x of state.transactions) {
      if (x.stationId !== st.id || x.sync !== 'synced' || x.ts < d.getTime() || x.status !== 'rejected' || !x.reason) continue;
      m.set(x.reason, (m.get(x.reason) ?? 0) + 1);
    }
    return { reasons: [...m.entries()].sort((a, b) => b[1] - a[1]) };
  }, [state.transactions, st, now]);

  if (!st || !o || !life) {
    return (
      <EmptyState icon="station" title="Không tìm thấy trạm" action={<a href="#hub-stations" className="btn btn-secondary">Về danh sách trạm</a>}>
        Mã trạm “{id}” không có trong danh sách trạm.
      </EmptyState>
    );
  }

  const tasks = state.tasks.filter((x) => x.stationId === st.id).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || b.createdAt - a.createdAt);
  const events = [
    ...state.log.filter((l) => l.stationId === st.id).map((l) => ({ ts: l.ts, text: logText(l.text), dot: logTone(l.level) })),
    ...state.collections.filter((c) => c.stationId === st.id).map((c) => ({ ts: c.ts, text: `${c.driver} thay thùng ${c.binId} · ${n0(c.bottleCount)} chai → lô ${c.batchId}`, dot: 'bg-forest' })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .filter((e, _i, arr) => !(e.text.startsWith('Đã thay thùng') && arr.some((x) => x.ts === e.ts && x !== e)))
    .slice(0, 10);
  const pending = state.transactions.filter((x) => x.stationId === st.id && x.sync === 'pending').length;
  const cap = binCapacityKg(state.settings);

  return (
    <>
      <PageHeader
        back={{ href: '#hub-stations', label: 'Trạm thu gom' }}
        title={
          <span className="flex flex-wrap items-baseline gap-x-3">
            <span className="id-tag">{st.id}</span>
            <span className="text-lg font-medium text-ink-2 md:text-xl">{st.name}</span>
          </span>
        }
        sub={`${st.site} · mở ${st.accessWindow.start}–${st.accessWindow.end}`}
        actions={
          <>
            <Button size="sm" icon="truck" onClick={() => setDlg('collect')} disabled={!!item?.collectionTask}>
              Lên lịch thu gom
            </Button>
            <Button size="sm" icon="wrench" onClick={() => setDlg('maint')}>
              Yêu cầu bảo trì
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Vận hành</span>
          <OpBadge op={o.op} stale={o.stale} />
        </div>
        <div className="card flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5">
          <span className="text-xs font-medium uppercase tracking-wider text-muted">Kết nối</span>
          <ConnBadge online={o.conn === 'online'} minutes={o.conn === 'offline' ? o.minutesSinceReading : undefined} />
          <span className="text-xs text-muted">Lần đọc cuối {dateTime(o.lastReadingTs)}</span>
        </div>
      </div>

      {item && (
        <Panel title="Việc cần làm" className="mb-5" pad={false}>
          <ul>
            <AttentionRow item={item} showLink={false} />
          </ul>
        </Panel>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Thùng hiện tại" actions={<span className="id-tag text-xs text-muted">{st.activeBinId}</span>}>
            <div className="flex items-start gap-4">
              <BinGauge pct={o.hubFillPct} warn={state.settings.warnPct} stop={state.settings.stopPct} stale={o.stale} />
              <dl className="flex min-w-0 flex-1 flex-col gap-3">
                <div>
                  <dt className="text-xs text-muted">Mức đầy</dt>
                  <dd className={`tnum text-3xl font-semibold leading-tight ${o.stale ? 'text-slate' : 'text-ink'}`}>{Math.round(o.hubFillPct)} %</dd>
                  <dd className="mt-0.5">{o.stale ? <StaleTag>lần cuối {dateTime(o.lastReadingTs).slice(6)}</StaleTag> : <span className="text-xs text-muted">đo lúc {dateTime(o.lastReadingTs).slice(6)}</span>}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Chai trong thùng</dt>
                  <dd className="tnum font-semibold text-ink">{n0(o.binBottles)} chai</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-muted">
                    Khối lượng <EstimateTag>theo bản ghi</EstimateTag>
                  </dt>
                  <dd className="tnum font-semibold text-ink">
                    {kg(o.binKg, 2)} <span className="font-normal text-muted">/ {kg(cap, 1)}</span>
                  </dd>
                </div>
              </dl>
            </div>
            {pending > 0 && (
              <p className="mt-3 flex items-start gap-1.5 rounded bg-slate-tint px-2.5 py-2 text-xs text-slate">
                <Icon name="sync" size={14} className="mt-px shrink-0" />
                Trạm có thể đang giữ thêm bản ghi chưa gửi. RE Hub chỉ hiển thị số đã nhận.
              </p>
            )}
            <p className="mt-3 text-xs text-muted">{t.hub.detail.fillCalc(kg(cap, 1))}</p>
          </Panel>

          <Panel title="Dự báo" actions={<EstimateTag />}>
            {o.op === 'jam' || o.op === 'estop' ? (
              <p className="text-sm text-muted">Trạm đang dừng xử lý nên không dự báo mức đầy.</p>
            ) : (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-muted">Đến 80 %</dt>
                  <dd className="tnum font-semibold text-ink">{hours(o.hoursTo80)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Đến 95 %</dt>
                  <dd className="tnum font-semibold text-ink">{hours(o.hoursTo95)}</dd>
                </div>
              </dl>
            )}
            <p className="mt-3 text-xs text-muted">
              Dùng lịch sử đã đồng bộ theo giờ/ngày; khi chưa đủ dữ liệu dùng giả định {n0(st.forecastRateBph)} chai/giờ. <a href="#hub-forecasts" className="text-forest underline">Xem biểu đồ và kịch bản</a>.
            </p>
          </Panel>

          <Panel title="Lũy kế" actions={<span className="text-xs text-muted">không reset khi thu gom</span>}>
            <dl className="grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs text-muted">Chai nhận</dt>
                <dd className="tnum font-semibold text-ink">{n0(life.acceptedBottles)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">PET ước tính</dt>
                <dd className="tnum font-semibold text-ink">{kg(life.acceptedKg, 1)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Trả lại</dt>
                <dd className="tnum font-semibold text-ink">
                  {n0(life.rejected)} <span className="text-xs font-normal text-muted">({n1(life.rejectionRatePct)} %)</span>
                </dd>
              </div>
            </dl>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Hôm nay" actions={<DemoTag />}>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs text-muted">Chai được nhận</dt>
                <dd className="tnum text-xl font-semibold text-ink">{n0(o.todayBottles)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Vật phẩm trả lại</dt>
                <dd className="tnum text-xl font-semibold text-ink">{n0(o.todayRejected)}</dd>
              </div>
            </dl>
            {today.reasons.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                {today.reasons.map(([r, c]) => (
                  <li key={r} className="flex justify-between">
                    <span className="text-ink-2">{t.reason[r]}</span>
                    <span className="tnum font-medium text-ink">{c}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Yêu cầu công việc" actions={<span className="tnum text-xs text-muted">{openTasks(state.tasks, st.id).length} đang mở</span>}>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">Chưa có yêu cầu nào cho trạm này.</p>
            ) : (
              <ul className="-my-3 divide-y divide-line">
                {tasks.slice(0, 6).map((x) => (
                  <TaskItem key={x.id} t={x} />
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Sự kiện">
            {events.length === 0 ? (
              <p className="text-sm text-muted">Chưa có sự kiện.</p>
            ) : (
              <ol className="relative flex flex-col gap-3 border-l border-line pl-4">
                {events.map((e, i) => (
                  <li key={i} className="relative text-sm">
                    <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-panel ${e.dot}`} aria-hidden />
                    <div className="text-ink">{e.text}</div>
                    <div className="tnum text-xs text-muted">
                      {dateTime(e.ts)} · {ago(e.ts, now)}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>

      <ScheduleCollectionDialog stationId={st.id} open={dlg === 'collect'} onClose={() => setDlg(null)} />
      {dlg === 'maint' && (
        <MaintenanceDialog stationId={st.id} reason={st.fault ?? (st.connection === 'offline' ? 'offline' : 'other')} open onClose={() => setDlg(null)} />
      )}
    </>
  );
}
