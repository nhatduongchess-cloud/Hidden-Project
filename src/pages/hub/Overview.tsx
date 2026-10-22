import { useMemo, useState } from 'react';
import { useAppState } from '../../lib/store-context';
import { allStationOps, attentionItems, type AttentionItem } from '../../domain/ops';
import { dailySeries, totals } from '../../domain/selectors';
import type { WorkReason } from '../../domain/types';
import { navigate } from '../../lib/router';
import { ago, dateTime, kg, n0, n1 } from '../../lib/format';
import { Icon, type IconName } from '../../components/icons';
import { Badge, Button, DemoTag, EmptyState, EstimateTag, Metric } from '../../components/ui';
import { DailyBars } from '../../components/charts';
import { NetworkMap } from './NetworkMap';
import {
  ATTN,
  FilterBar,
  MaintenanceDialog,
  PageHeader,
  Panel,
  PERIODS,
  REASON_LABEL,
  ResolveDialog,
  ScheduleCollectionDialog,
  SEVERITY_STYLE,
  kindNeeds,
  logText,
  logTone,
  periodStart,
  taskStatusText,
  useHubFilter,
} from './shared';

/** One station that needs someone: what is wrong, why it matters, and the next step. */
export function AttentionRow({ item, showLink = true }: { item: AttentionItem; showLink?: boolean }) {
  const state = useAppState();
  const [dlg, setDlg] = useState<null | 'collect' | 'maint' | 'resolve'>(null);
  const sev = SEVERITY_STYLE[item.severity];
  const meta = ATTN[item.kind];
  const st = item.ops.station;
  const needs = [...new Set([item.kind, ...item.also].map(kindNeeds))];
  const maintReason: WorkReason = item.kind === 'jam' || item.kind === 'estop' || item.kind === 'offline' ? item.kind : item.also.includes('offline') ? 'offline' : 'other';

  const actions = needs.map((n, i) => {
    const variant = i === 0 && item.kind !== 'forecast' ? 'primary' : 'secondary';
    if (n === 'collection') {
      if (item.collectionTask?.routeId)
        return (
          <a key={n} href="#hub-routes" className="btn btn-secondary btn-sm">
            <Icon name="route" size={16} /> Xem tuyến {item.collectionTask.routeId}
          </a>
        );
      if (item.collectionTask)
        return (
          <Button key={n} size="sm" variant={variant} icon="route" onClick={() => navigate('hub-routes')}>
            Lập tuyến
          </Button>
        );
      return (
        <Button key={n} size="sm" variant={variant} icon="truck" onClick={() => setDlg('collect')}>
          Lên lịch thu gom
        </Button>
      );
    }
    if (item.maintenanceTask)
      return (
        <Button key={n} size="sm" variant={variant} icon="check" onClick={() => setDlg('resolve')}>
          Xác nhận đã xử lý
        </Button>
      );
    return (
      <Button key={n} size="sm" variant={variant} icon="wrench" onClick={() => setDlg('maint')}>
        {maintReason === 'offline' ? 'Yêu cầu kiểm tra kết nối' : 'Tạo yêu cầu bảo trì'}
      </Button>
    );
  });

  const tasks = [item.collectionTask, item.maintenanceTask].filter(Boolean);

  return (
    <li className="relative flex gap-3 py-4 pl-4 pr-1 sm:pr-4">
      <span className={`absolute inset-y-3 left-0 w-1 rounded-full ${sev.bar}`} aria-hidden />
      <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ${sev.ring} ${sev.icon}`}>
        <Icon name={meta.icon} size={18} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <a href={`#hub-station-${st.id}`} className="id-tag font-semibold text-ink hover:underline">
            {st.id}
          </a>
          <span className="text-sm text-muted">{st.name}</span>
        </div>
        <div className="mt-0.5 font-semibold text-ink">
          <span className="sr-only">{sev.label}: </span>
          {meta.title(item.ops)}
        </div>
        <p className="mt-0.5 max-w-[64ch] text-sm text-ink-2">{meta.why(item.ops, state)}</p>
        {item.also.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.also.map((k) => (
              <Badge key={k} tone={k === 'offline' ? 'slate' : k === 'full' || k === 'jam' || k === 'estop' ? 'fault' : 'amber'} icon={ATTN[k].icon}>
                {ATTN[k].title(item.ops)}
              </Badge>
            ))}
          </div>
        )}
        {tasks.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink-2">
            {tasks.map((t) => (
              <li key={t!.id} className="flex items-center gap-1.5">
                <Icon name={t!.kind === 'collection' ? 'truck' : 'wrench'} size={13} className="text-muted" />
                <span className="id-tag">{t!.id}</span> {taskStatusText(state, t!)}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions}
          {showLink && (
            <a href={`#hub-station-${st.id}`} className="btn btn-ghost btn-sm">
              Chi tiết trạm
            </a>
          )}
        </div>
      </div>
      <ScheduleCollectionDialog stationId={st.id} open={dlg === 'collect'} onClose={() => setDlg(null)} />
      {dlg === 'maint' && <MaintenanceDialog stationId={st.id} reason={maintReason} open onClose={() => setDlg(null)} />}
      {dlg === 'resolve' && item.maintenanceTask && <ResolveDialog task={item.maintenanceTask} open onClose={() => setDlg(null)} />}
    </li>
  );
}

function StatusTile({ icon, value, label, sub, tone, href }: { icon: IconName; value: number; label: string; sub: string; tone: 'forest' | 'amber' | 'fault' | 'slate'; href: string }) {
  const c = { forest: 'text-forest', amber: 'text-amber-ink', fault: 'text-fault-ink', slate: 'text-slate' }[tone];
  return (
    <a href={href} className="card group flex min-w-0 items-start gap-3 p-3.5 transition-colors hover:border-line-strong">
      <Icon name={icon} size={20} className={`mt-0.5 ${value ? c : 'text-muted'}`} strokeWidth={2} />
      <div className="min-w-0">
        <div className={`tnum text-2xl font-semibold leading-none ${value ? 'text-ink' : 'text-muted'}`}>{value}</div>
        <div className="mt-1 text-sm font-medium text-ink-2">{label}</div>
        <div className="id-tag mt-0.5 truncate text-xs text-muted">{sub || '—'}</div>
      </div>
    </a>
  );
}

export function Overview() {
  const state = useAppState();
  const f = useHubFilter();
  const now = Date.now();
  const ops = allStationOps(state, now);
  const items = attentionItems(state, now);
  const urgent = items.filter((i) => i.kind !== 'forecast');
  const upcoming = items.filter((i) => i.kind === 'forecast');

  const from = periodStart(f.period, now);
  const scoped = useMemo(
    () => state.transactions.filter((t) => t.sync === 'synced' && t.ts >= from && (f.stationId === 'all' || t.stationId === f.stationId)),
    [state.transactions, from, f.stationId],
  );
  const tot = totals(scoped);
  const pendingCount = state.transactions.filter((t) => t.sync === 'pending' && (f.stationId === 'all' || t.stationId === f.stationId)).length;
  const days = PERIODS.find((p) => p.value === f.period)!.days;
  const series = dailySeries(
    state.transactions.filter((t) => t.sync === 'synced' && (f.stationId === 'all' || t.stationId === f.stationId)),
    days,
    now,
  );

  const accepting = ops.filter((o) => o.op === 'accepting' && !o.stale);
  const needCollect = ops.filter((o) => o.op === 'warning' || o.op === 'stopped');
  const faults = ops.filter((o) => o.op === 'jam' || o.op === 'estop');
  const offline = ops.filter((o) => o.conn === 'offline');

  const activity = [
    ...state.log.filter((l) => l.stationId && (f.stationId === 'all' || l.stationId === f.stationId)).map((l) => ({ ts: l.ts, stationId: l.stationId!, text: logText(l.text), dot: logTone(l.level) })),
    ...state.tasks
      .filter((t) => f.stationId === 'all' || t.stationId === f.stationId)
      .map((t) => ({ ts: t.resolvedAt ?? t.createdAt, stationId: t.stationId, text: t.status === 'done' ? `Đóng ${t.id}: ${t.resolution?.startsWith('bin_swapped') ? 'đã thay thùng' : (t.resolution ?? '')}` : `Tạo ${t.id}: ${t.kind === 'collection' ? 'thu gom' : 'bảo trì'} · ${REASON_LABEL[t.reason]}`, dot: 'bg-info' })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="Tổng quan"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            Điều hành mạng lưới · {state.stations.length} trạm · {dateTime(now)} <DemoTag />
          </span>
        }
        actions={<a href="#hub-routes" className="btn btn-primary"><Icon name="route" size={17}/>Lập tuyến thu gom</a>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatusTile icon="checkCircle" value={accepting.length} label="Đang nhận chai" sub={accepting.map((o) => o.station.id).join(', ')} tone="forest" href="#hub-stations" />
        <StatusTile icon="alert" value={needCollect.length} label={`Cần thu gom (≥ ${state.settings.warnPct} %)`} sub={needCollect.map((o) => o.station.id).join(', ')} tone="amber" href="#hub-routes" />
        <StatusTile icon="stop" value={faults.length} label="Lỗi, dừng xử lý" sub={faults.map((o) => o.station.id).join(', ')} tone="fault" href="#hub-stations" />
        <StatusTile icon="wifiOff" value={offline.length} label="Mất kết nối" sub={offline.map((o) => o.station.id).join(', ')} tone="slate" href="#hub-stations" />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel id="map-title" title="Bản đồ mạng lưới" actions={<a href="#hub-forecasts" className="ops-text-link">Xem dự báo <Icon name="arrowRight" size={14}/></a>} pad={false}><NetworkMap /></Panel>
        <Panel
          id="attn-title"
          title={
            <span className="flex items-center gap-2">
              Cần xử lý
              <span className="tnum rounded-full bg-ink px-2 text-xs font-bold text-paper">{urgent.length}</span>
            </span>
          }
          actions={<span className="text-xs text-muted">Nghiêm trọng nhất ở trên</span>}
          pad={false}
        >
          {urgent.length === 0 ? (
            <div className="p-4">
              <EmptyState icon="checkCircle" title="Không có trạm cần xử lý">
                Mọi trạm đang nhận chai và dưới 80 %.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {urgent.map((i) => (
                <AttentionRow key={i.stationId} item={i} />
              ))}
            </ul>
          )}
          {upcoming.length > 0 && (
            <div className="border-t border-line bg-sunk/40">
              <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wider text-muted">Sắp cần thu gom</div>
              <ul className="divide-y divide-line">
                {upcoming.map((i) => (
                  <AttentionRow key={i.stationId} item={i} />
                ))}
              </ul>
            </div>
          )}
        </Panel>

      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel
          id="trend-title"
          title={`Chai được nhận · ${PERIODS.find((p) => p.value === f.period)!.label.toLowerCase()}${f.stationId !== 'all' ? ` · ${f.stationId}` : ''}`}
          actions={<FilterBar />}
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Chai được nhận" value={n0(tot.acceptedBottles)} unit="chai" />
            <Metric label="Khối lượng PET" value={n1(tot.acceptedKg)} unit="kg" sub={<EstimateTag>Theo bản ghi trạm</EstimateTag>} />
            <Metric label="Vật phẩm trả lại" value={n0(tot.rejected)} sub={`${n1(tot.rejectionRatePct)} % số lượt`} />
            <Metric label="Điểm đã ghi nhận" value={n0(tot.points)} unit="điểm" />
          </div>
          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>Khối lượng PET theo ngày ({days} ngày, kg ước tính)</span>
            </div>
            <DailyBars data={series} label={`Khối lượng PET nhận theo ngày, ${days} ngày gần nhất`} />
          </div>
          {pendingCount > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate">
              <Icon name="sync" size={13} /> Chưa gồm {n0(pendingCount)} bản ghi đang chờ đồng bộ từ trạm mất kết nối.
            </p>
          )}
        </Panel>

        <Panel id="act-title" title="Hoạt động gần đây">
          {activity.length === 0 ? (
            <p className="text-sm text-muted">Chưa có hoạt động.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {activity.map((a, i) => (
                <li key={i} className="flex gap-2.5 text-sm">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.dot}`} aria-hidden />
                  <div className="min-w-0">
                    <div className="text-ink">
                      <a href={`#hub-station-${a.stationId}`} className="id-tag font-semibold hover:underline">
                        {a.stationId}
                      </a>{' '}
                      {a.text}
                    </div>
                    <div className="text-xs text-muted">{ago(a.ts, now)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
            Thu gom gần nhất:{' '}
            {(() => {
              const c = [...state.collections].sort((a, b) => b.ts - a.ts)[0];
              return c ? (
                <span className="text-ink-2">
                  {c.stationId} · {n0(c.bottleCount)} chai · {kg(c.estimatedKg, 1)} ước tính · {ago(c.ts, now)}
                </span>
              ) : (
                'chưa có'
              );
            })()}
          </div>
        </Panel>
      </div>
    </>
  );
}
