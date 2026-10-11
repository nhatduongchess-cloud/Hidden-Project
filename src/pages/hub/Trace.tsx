import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useAppState, useStore } from '../../lib/store-context';
import { summarizeBatch, transactionsCsv, batchesCsv, filteredTxRows, type BatchSummary } from '../../domain/report';
import { totals, EMPTY_FILTERS, type TxFilters } from '../../domain/selectors';
import { batchBrandShare, batchGaps, batchStages, type Gap, type Stage, type StageKey } from '../../domain/ops';
import { DISCREPANCY_FLAG_PCT, RECEIVING_PARTNER } from '../../domain/constants';
import { newId } from '../../domain/ids';
import type { Batch, BrandId, EvidenceKind } from '../../domain/types';
import { navigate } from '../../lib/router';
import { dateOnly, dateTime, isoDay, kg, n0, n1, n2, n3 } from '../../lib/format';
import { Icon, type IconName } from '../../components/icons';
import { Alert, Badge, Button, DemoTag, Disclosure, Drawer, EmptyState, EstimateTag, Metric, NumberField, SearchField, Segmented, SelectField, TextField, toast, type Tone } from '../../components/ui';
import { buildReportHtml, type ReportArgs } from './reportHtml';
import { PageHeader, Panel, offerFile } from './shared';
import { describeFilters } from './Transactions';

const STAGE_LABEL: Record<StageKey, string> = {
  station: 'Thu tại trạm',
  pickup: 'Tài xế thu gom',
  weighed: 'Tiếp nhận và cân',
  handover: 'Chuyển cho bên tái chế',
  downstream: 'Bằng chứng hạ nguồn',
};

const STATUS: Record<Batch['status'], { label: string; tone: Tone; icon: IconName }> = {
  open: { label: 'Đang gom · chờ cân', tone: 'amber', icon: 'truck' },
  received: { label: 'Đã cân tiếp nhận', tone: 'info', icon: 'scale' },
  handed_over: { label: 'Đã chuyển bên tái chế', tone: 'forest', icon: 'checkCircle' },
};

function signed(v: number, d: 1 | 2 = 2) {
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${d === 2 ? n2(Math.abs(v)) : n1(Math.abs(v))}`;
}

function gapText(g: Gap): string {
  switch (g.kind) {
    case 'discrepancy':
      return `Khối lượng cân lệch ${signed(g.value ?? 0, 1)} % so với ước tính (ngưỡng ${DISCREPANCY_FLAG_PCT} %)`;
    case 'no_weigh_ticket':
      return 'Chưa có phiếu cân tiếp nhận';
    case 'no_handover':
      return 'Chưa ghi chuyển giao cho bên tái chế';
    case 'no_recycler_doc':
      return 'Thiếu tài liệu từ bên tái chế';
    case 'no_downstream':
      return 'Chưa ghi kết quả hạ nguồn';
    case 'pending_records':
      return `${g.value} bản ghi trạm chưa đồng bộ`;
  }
}

/** Five dots for the table: done, pending or missing per stage. */
function StageDots({ stages }: { stages: Stage[] }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={stages.map((s) => `${STAGE_LABEL[s.key]}: ${s.status === 'done' ? 'xong' : s.status === 'missing' ? 'thiếu' : 'chưa'}`).join(', ')}>
      {stages.map((s) => (
        <span
          key={s.key}
          className={`h-2.5 w-2.5 ${s.status === 'done' ? 'rounded-full bg-forest' : s.status === 'missing' ? 'rotate-45 rounded-[1px] bg-fault' : 'rounded-full border border-line-strong bg-white'}`}
        />
      ))}
    </span>
  );
}

type Range = '30d' | '90d' | 'all';

function batchInRange(state: ReturnType<typeof useAppState>, b: Batch, from: number) {
  if (b.status === 'open') return true;
  const cols = state.collections.filter((c) => c.batchId === b.id);
  return cols.some((c) => c.ts >= from) || b.createdAt >= from;
}

export function Trace({ batchId }: { batchId?: string }) {
  const t = useT();
  const state = useAppState();
  const operator = state.role === 'operator';
  const brand = state.brandView;
  const [q, setQ] = useState('');
  const [range, setRange] = useState<Range>('all');
  const now = Date.now();
  const from = range === 'all' ? -Infinity : now - (range === '30d' ? 30 : 90) * 86_400_000;

  const summaries = useMemo(() => state.batches.map((b) => summarizeBatch(state, b)), [state]);
  const visible = summaries
    .filter((s) => batchInRange(state, s.batch, from))
    .filter((s) => {
      if (!q.trim()) return true;
      const needle = q.trim().toLowerCase();
      return [s.batch.id, ...s.stations, s.batch.receiving?.ticketNo ?? ''].some((x) => x.toLowerCase().includes(needle));
    })
    .sort((a, b) => b.batch.createdAt - a.batch.createdAt);

  const scopeTx = useMemo(() => {
    const f: TxFilters = { ...EMPTY_FILTERS, from: range === 'all' ? '' : isoDay(from) };
    return { f, rows: filteredTxRows(state, f) };
  }, [state, range, from]);
  const tot = totals(scopeTx.rows);
  const withGaps = visible.filter((s) => batchGaps(state, s.batch, now).some((g) => g.severity === 'warn')).length;
  const measuredKg = visible.reduce((s, x) => s + (x.measuredKg ?? 0), 0);

  const reportArgs = (): ReportArgs => ({
    title: 'Tài liệu hỗ trợ báo cáo EPR',
    period: range === 'all' ? `Toàn bộ dữ liệu demo đến ${dateOnly(now)}` : `${dateOnly(from)} → ${dateOnly(now)}`,
    filters: describeFilters(scopeTx.f, state, t),
    units: 'Đơn vị: chai (chiếc), khối lượng (kg), tỷ lệ (%)',
    disclaimer: 'Tài liệu hỗ trợ cho việc rà soát EPR. Không phải chứng nhận, hồ sơ đã được phê duyệt hay bằng chứng tuân thủ. Số liệu trong bản mẫu là dữ liệu demo.',
    generated: dateTime(now),
    totals: tot,
    stations: state.stations.map((s) => ({ id: s.id, ...totals(scopeTx.rows.filter((x) => x.stationId === s.id)) })),
    batches: visible.map((s) => ({
      id: s.batch.id,
      status: STATUS[s.batch.status].label,
      stations: s.stations.join(', '),
      est: s.estimatedKg,
      measured: s.measuredKg,
      disc: s.discrepancyKg,
      discPct: s.discrepancyPct,
      evidence: batchGaps(state, s.batch, now).map(gapText).join('; ') || 'Đủ tài liệu theo quy trình demo',
      downstream: s.confirmedDownstreamKg,
    })),
    role: operator ? 'Đơn vị vận hành' : `Nhãn hàng: ${t.brand[brand]}`,
  });

  const open = batchId ? state.batches.find((b) => b.id === batchId) : undefined;

  return (
    <>
      <PageHeader
        title="Truy xuất & báo cáo"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            {operator ? 'Theo dõi từng lô từ trạm đến bên tái chế' : `${t.brand[brand]} · số chai theo mã vạch`} <DemoTag />
          </span>
        }
        actions={
          <>
            <Segmented
              label="Khoảng thời gian"
              hideLabel
              name="trace-range"
              size="sm"
              value={range}
              onChange={setRange}
              options={[
                { value: '30d', label: '30 ngày' },
                { value: '90d', label: '90 ngày' },
                { value: 'all', label: 'Tất cả' },
              ]}
            />
            <Button variant="primary" icon="download" onClick={() => offerFile(`re-tai-lieu-ho-tro-epr-${isoDay(now)}.html`, buildReportHtml(reportArgs()), 'text/html')}>
              Xuất tài liệu EPR
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 rounded-lg border border-line bg-panel p-4 md:grid-cols-4">
        <Metric label={operator ? 'Chai được nhận' : 'Chai có mã vạch nhãn hàng'} value={n0(tot.acceptedBottles)} unit="chai" />
        <Metric label="Khối lượng theo bản ghi" value={n1(tot.acceptedKg)} unit="kg" sub={<EstimateTag />} />
        <Metric label="Đã cân (cả lô)" value={n1(measuredKg)} unit="kg" sub={<span className="inline-flex items-center gap-1"><Icon name="scale" size={12} /> Phiếu cân</span>} />
        <Metric label="Lô thiếu bằng chứng" value={`${withGaps}/${visible.length}`} tone={withGaps ? 'amber' : undefined} />
      </div>
      {!operator && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-2">
          <Icon name="info" size={14} className="mt-px shrink-0 text-info" />
          Khối lượng cân là của cả lô, không chia theo nhãn hàng. Phần của nhãn hàng tính từ mã vạch và khối lượng ước tính.
        </p>
      )}

      <Panel
        title="Lô vật liệu"
        className="mt-5"
        pad={false}
        actions={
          <div className="w-[220px]">
            <SearchField id="trace-search" label="Tìm lô, trạm hoặc số phiếu cân" value={q} onChange={setQ} placeholder="Tìm lô, trạm, phiếu cân" />
          </div>
        }
      >
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState icon="search" title="Không có lô khớp" action={<Button onClick={() => (setQ(''), setRange('all'))}>Xóa tìm kiếm</Button>} />
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table-base min-w-[920px]">
                <thead>
                  <tr>
                    <th>Lô</th>
                    <th>Trạng thái</th>
                    <th>Hành trình</th>
                    <th>Trạm nguồn</th>
                    <th className="text-right">Ước tính</th>
                    <th className="text-right">Đã cân</th>
                    <th className="text-right">Chênh lệch</th>
                    {!operator && <th className="text-right">Phần nhãn hàng</th>}
                    <th>Bằng chứng</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((s) => {
                    const gaps = batchGaps(state, s.batch, now);
                    const warn = gaps.filter((g) => g.severity === 'warn');
                    const share = batchBrandShare(state, s.batch, brand);
                    const flagged = s.discrepancyPct !== null && Math.abs(s.discrepancyPct) > DISCREPANCY_FLAG_PCT;
                    return (
                      <tr key={s.batch.id} className="cursor-pointer hover:bg-sunk/50" onClick={() => navigate({ name: 'hub-trace', param: s.batch.id }, { keepScroll: true })}>
                        <td>
                          <a href={`#hub-trace-${s.batch.id}`} className="id-tag font-semibold text-forest hover:underline" onClick={(e) => e.stopPropagation()}>
                            {s.batch.id}
                          </a>
                        </td>
                        <td>
                          <Badge tone={STATUS[s.batch.status].tone} icon={STATUS[s.batch.status].icon}>
                            {STATUS[s.batch.status].label}
                          </Badge>
                        </td>
                        <td>
                          <StageDots stages={batchStages(state, s.batch)} />
                        </td>
                        <td className="id-tag text-sm">{s.stations.join(', ') || '—'}</td>
                        <td className="tnum text-right">{kg(s.estimatedKg, 2)}</td>
                        <td className="tnum text-right">{s.measuredKg === null ? '—' : kg(s.measuredKg, 2)}</td>
                        <td className={`tnum text-right ${flagged ? 'font-semibold text-fault-ink' : ''}`}>
                          {s.discrepancyPct === null ? '—' : `${signed(s.discrepancyPct, 1)} %`}
                          {flagged && <Icon name="flag" size={13} className="ml-1 inline" aria-label="vượt ngưỡng" />}
                        </td>
                        {!operator && (
                          <td className="tnum text-right">
                            {n0(share.bottles)} chai · {kg(share.estKg, 2)}
                          </td>
                        )}
                        <td>
                          {warn.length ? (
                            <Badge tone="amber" icon="fileMissing">
                              Thiếu {warn.length}
                            </Badge>
                          ) : gaps.length ? (
                            <span className="text-xs text-muted">Đang chờ bước tiếp</span>
                          ) : (
                            <Badge tone="forest" icon="check">
                              Đủ
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-line md:hidden">
              {visible.map((s) => {
                const warn = batchGaps(state, s.batch, now).filter((g) => g.severity === 'warn');
                return (
                  <li key={s.batch.id}>
                    <a href={`#hub-trace-${s.batch.id}`} className="flex flex-col gap-2 px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="id-tag font-semibold text-forest">{s.batch.id}</span>
                        <Badge tone={STATUS[s.batch.status].tone} icon={STATUS[s.batch.status].icon}>
                          {STATUS[s.batch.status].label}
                        </Badge>
                      </div>
                      <StageDots stages={batchStages(state, s.batch)} />
                      <div className="tnum text-sm text-ink-2">
                        Ước tính {kg(s.estimatedKg, 1)} · cân {s.measuredKg === null ? '—' : kg(s.measuredKg, 1)}
                      </div>
                      {warn.length > 0 && <div className="text-xs font-medium text-amber-ink">Thiếu {warn.length} bằng chứng</div>}
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-4 py-2.5 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-forest" /> Xong
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-line-strong bg-white" /> Chưa tới
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rotate-45 rounded-[1px] bg-fault" /> Thiếu bằng chứng
              </span>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Tài liệu hỗ trợ báo cáo EPR" className="mt-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0 text-sm text-ink-2">
            <p>Gồm số chai và khối lượng theo bản ghi trạm, khối lượng cân theo lô, chênh lệch và tình trạng bằng chứng của từng lô trong khoảng đã chọn.</p>
            <Alert tone="info" className="mt-3" title="Không phải chứng nhận">
              Tài liệu giúp rà soát số liệu trước khi lập báo cáo EPR. Nó không xác nhận tuân thủ và không thay hồ sơ đã được cơ quan có thẩm quyền chấp thuận.
            </Alert>
          </div>
          <div className="flex flex-col gap-2 lg:w-[240px]">
            <Button variant="primary" icon="download" onClick={() => offerFile(`re-tai-lieu-ho-tro-epr-${isoDay(now)}.html`, buildReportHtml(reportArgs()), 'text/html')}>
              Tài liệu (HTML)
            </Button>
            <Button icon="download" onClick={() => offerFile(`re-giao-dich-${isoDay(now)}.csv`, transactionsCsv(state, scopeTx.f), 'text/csv')}>
              CSV giao dịch
            </Button>
            {operator && (
              <Button icon="download" onClick={() => offerFile(`re-lo-${isoDay(now)}.csv`, batchesCsv(state), 'text/csv')}>
                CSV lô
              </Button>
            )}
          </div>
        </div>
        <Disclosure summary="Xem trước tài liệu" className="mt-4">
          <ReportView args={reportArgs()} />
        </Disclosure>
      </Panel>

      <Drawer open={!!open} onClose={() => navigate('hub-trace', { keepScroll: true })} title={open ? <span className="flex flex-wrap items-center gap-2">Lô <span className="id-tag">{open.id}</span></span> : ''} width={680}>
        {open && <BatchDetail batch={open} sum={summaries.find((s) => s.batch.id === open.id)!} />}
      </Drawer>
      {batchId && !open && (
        <Alert tone="warn" className="mt-5" title={`Không tìm thấy lô ${batchId}`}>
          Lô này không có trong dữ liệu demo hiện tại.
        </Alert>
      )}
    </>
  );
}

function StageIcon({ s }: { s: Stage['status'] }) {
  if (s === 'done')
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-forest text-white">
        <Icon name="check" size={15} strokeWidth={2.4} />
      </span>
    );
  if (s === 'missing')
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-fault-tint text-fault-ink">
        <Icon name="fileMissing" size={15} />
      </span>
    );
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-dashed border-line-strong bg-white text-muted">
      <Icon name="clock" size={13} />
    </span>
  );
}

function BatchDetail({ batch, sum }: { batch: Batch; sum: BatchSummary }) {
  const t = useT();
  const state = useAppState();
  const store = useStore();
  const operator = state.role === 'operator';
  const now = Date.now();
  const stages = batchStages(state, batch);
  const gaps = batchGaps(state, batch, now);
  const cols = state.collections.filter((c) => c.batchId === batch.id).sort((a, b) => a.ts - b.ts);
  const suggested = Math.round(sum.estimatedKg * 0.97 * 100) / 100;
  const [measured, setMeasured] = useState(suggested);
  const [ticket, setTicket] = useState(`PC-DEMO-${batch.id.slice(-4)}`);
  const [evKind, setEvKind] = useState<EvidenceKind>('recycler_document');
  const [downKg, setDownKg] = useState(Math.round((sum.measuredKg ?? 0) * 0.95 * 100) / 100);
  const flagged = sum.discrepancyPct !== null && Math.abs(sum.discrepancyPct) > DISCREPANCY_FLAG_PCT;

  const brands = useMemo(() => {
    const ids: BrandId[] = operator ? ['BRAND_A', 'BRAND_B', 'BRAND_C', 'UNKNOWN'] : [state.brandView];
    return ids.map((b) => ({ b, ...batchBrandShare(state, batch, b) }));
  }, [state, batch, operator]);

  const stageDetail = (k: StageKey): string => {
    switch (k) {
      case 'station':
        return cols.length ? `${n0(sum.txCount)} lượt bỏ chai · ${sum.stations.join(', ')}` : 'Chưa có chuyến thu gom';
      case 'pickup':
        return cols.length ? `${cols.length} lần thay thùng · ${[...new Set(cols.map((c) => c.driver))].join(', ')}` : 'Chưa thu gom';
      case 'weighed':
        return batch.receiving ? `Phiếu ${batch.receiving.ticketNo} · ${kg(batch.receiving.measuredKg, 2)}` : 'Chưa cân';
      case 'handover':
        return batch.handover ? batch.handover.partner : 'Chưa chuyển';
      case 'downstream':
        return batch.downstream ? `${kg(batch.downstream.confirmedKg, 2)} · ${batch.downstream.note}` : sum.hasRecyclerDocument ? 'Đã có tài liệu, chưa ghi số liệu' : batch.handover ? 'Thiếu tài liệu từ bên tái chế' : 'Chưa tới bước này';
    }
  };

  const attach = (kind: EvidenceKind, file?: File) => {
    const ev = {
      id: newId('EV'),
      kind,
      label: file ? file.name : `${t.hub.trace.evKinds[kind]} (mẫu demo)`,
      fileName: file ? file.name : `${batch.id}-${kind}-mau.pdf`,
      ts: Date.now(),
      origin: 'attached' as const,
      sizeBytes: file?.size,
    };
    store.dispatch({ type: 'BATCH_ATTACH_EVIDENCE', batchId: batch.id, evidence: ev });
    toast(`Đã đính kèm ${ev.fileName}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS[batch.status].tone} icon={STATUS[batch.status].icon}>
          {STATUS[batch.status].label}
        </Badge>
        <span className="text-xs text-muted">Tạo {dateTime(batch.createdAt)}</span>
        <DemoTag />
      </div>

      <section aria-labelledby="bd-journey">
        <h3 id="bd-journey" className="mb-3 text-sm font-semibold text-ink">
          Hành trình 5 bước
        </h3>
        <ol className="relative flex flex-col gap-4">
          {stages.map((s, i) => (
            <li key={s.key} className="relative flex gap-3">
              {i < stages.length - 1 && <span className={`absolute left-[13px] top-8 h-[calc(100%-12px)] w-0.5 ${s.status === 'done' ? 'bg-forest/50' : 'bg-line'}`} aria-hidden />}
              <StageIcon s={s.status} />
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium text-ink">
                    {i + 1}. {STAGE_LABEL[s.key]}
                  </span>
                  <span className="tnum text-xs text-muted">{s.ts ? dateTime(s.ts) : s.status === 'missing' ? 'thiếu' : 'chưa'}</span>
                </div>
                <div className={`text-sm ${s.status === 'missing' ? 'text-fault-ink' : 'text-ink-2'}`}>{stageDetail(s.key)}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="bd-mass">
        <h3 id="bd-mass" className="mb-3 text-sm font-semibold text-ink">
          Khối lượng
        </h3>
        <div className="grid gap-px overflow-hidden rounded border border-line bg-line sm:grid-cols-3">
          <div className="bg-panel p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              Ước tính <EstimateTag>bản ghi trạm</EstimateTag>
            </div>
            <div className="tnum mt-1 text-xl font-semibold text-ink">{kg(sum.estimatedKg, 2)}</div>
          </div>
          <div className="bg-panel p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              Đã cân <Icon name="scale" size={13} />
            </div>
            <div className="tnum mt-1 text-xl font-semibold text-ink">{sum.measuredKg === null ? '—' : kg(sum.measuredKg, 2)}</div>
          </div>
          <div className={`p-3 ${flagged ? 'bg-amber-tint' : 'bg-panel'}`}>
            <div className="text-xs text-muted">Chênh lệch</div>
            <div className={`tnum mt-1 text-xl font-semibold ${flagged ? 'text-amber-ink' : 'text-ink'}`}>
              {sum.discrepancyKg === null ? '—' : `${signed(sum.discrepancyKg)} kg`}
            </div>
            <div className="text-xs text-muted">{sum.discrepancyPct === null ? 'Cần phiếu cân' : `${signed(sum.discrepancyPct, 1)} % · ngưỡng ${DISCREPANCY_FLAG_PCT} %`}</div>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">Ước tính và số cân luôn hiển thị riêng. Chai đã thu gom không được tự động tính là đã tái chế.</p>
      </section>

      <section aria-labelledby="bd-gaps">
        <h3 id="bd-gaps" className="mb-3 text-sm font-semibold text-ink">
          Bằng chứng còn thiếu
        </h3>
        {gaps.length === 0 ? (
          <Alert tone="success" title="Đủ bằng chứng theo quy trình demo" />
        ) : (
          <ul className="flex flex-col gap-2">
            {gaps.map((g) => (
              <li key={g.kind}>
                <Alert tone={g.severity === 'warn' ? 'warn' : 'info'} title={gapText(g)}>
                  {g.kind === 'discrepancy' && 'Đối chiếu phiếu cân với bản ghi trạm trước khi dùng số liệu này.'}
                  {g.kind === 'pending_records' && 'Trạm sẽ gửi khi có mạng. Số liệu lô có thể thay đổi.'}
                  {g.kind === 'no_recycler_doc' && 'Cần tài liệu thật từ bên tái chế. Bản mẫu không tạo thay.'}
                </Alert>
              </li>
            ))}
          </ul>
        )}
      </section>

      {operator && (
        <section aria-labelledby="bd-actions" className="rounded border border-line bg-sunk/50 p-4">
          <h3 id="bd-actions" className="mb-3 text-sm font-semibold text-ink">
            Bước tiếp theo
          </h3>
          {batch.status === 'open' &&
            (cols.length === 0 ? (
              <p className="text-sm text-muted">Lô đang mở chưa có chuyến thu gom nào.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <NumberField id="rcv-kg" label="Khối lượng cân" unit="kg" value={measured} min={0} max={100000} step={0.01} onChange={setMeasured} />
                <TextField id="rcv-ticket" label="Số phiếu cân" value={ticket} onChange={setTicket} />
                <Button
                  variant="primary"
                  icon="scale"
                  onClick={() => {
                    store.dispatch({ type: 'BATCH_RECEIVE', batchId: batch.id, measuredKg: measured, ticketNo: ticket || `PC-DEMO-${batch.id.slice(-4)}`, ts: Date.now() });
                    toast(`Đã ghi cân ${kg(measured, 2)} cho ${batch.id}`);
                  }}
                >
                  Ghi cân
                </Button>
                <p className="text-xs text-muted sm:col-span-3">Giá trị gợi ý = 97 % ước tính, chỉ để demo. Nhập số trên phiếu cân thật.</p>
              </div>
            ))}
          {batch.status === 'received' && (
            <Button
              variant="primary"
              icon="truck"
              onClick={() => {
                store.dispatch({ type: 'BATCH_HANDOVER', batchId: batch.id, partner: RECEIVING_PARTNER, ts: Date.now() });
                toast(`Đã ghi chuyển ${batch.id} cho bên tái chế`);
              }}
            >
              Ghi chuyển cho bên tái chế
            </Button>
          )}
          {batch.status === 'handed_over' && !batch.downstream && (
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <NumberField id="down-kg" label="Khối lượng bên tái chế xác nhận" unit="kg" value={downKg} min={0} max={100000} step={0.01} onChange={setDownKg} disabled={!sum.hasRecyclerDocument} />
              <Button
                disabled={!sum.hasRecyclerDocument}
                onClick={() => store.dispatch({ type: 'BATCH_RECORD_DOWNSTREAM', batchId: batch.id, confirmedKg: downKg, note: 'Ghi theo tài liệu bên tái chế (demo)', ts: Date.now() })}
              >
                Ghi kết quả hạ nguồn
              </Button>
              {!sum.hasRecyclerDocument && <p className="text-xs text-muted sm:col-span-2">Đính kèm tài liệu từ bên tái chế trước khi ghi số liệu.</p>}
            </div>
          )}
          {batch.status === 'handed_over' && batch.downstream && <p className="text-sm text-ink-2">Lô đã có kết quả hạ nguồn theo tài liệu đính kèm.</p>}

          <div className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <SelectField
              id="ev-kind"
              label="Đính kèm tài liệu"
              value={evKind}
              onChange={setEvKind}
              options={(['recycler_document', 'weigh_ticket', 'handover_note', 'collection_note', 'station_log'] as EvidenceKind[]).map((k) => ({ value: k, label: t.hub.trace.evKinds[k] }))}
            />
            <label className="btn btn-secondary cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-forest">
              <Icon name="upload" size={16} /> Chọn tệp
              <input type="file" className="sr-only" onChange={(e) => e.target.files?.[0] && (attach(evKind, e.target.files[0]), (e.target.value = ''))} />
            </label>
            <Button variant="ghost" onClick={() => attach(evKind)}>
              Thêm tệp mẫu
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Tệp chỉ được ghi tên và dung lượng trong trình duyệt này. Không tải lên đâu cả.</p>
        </section>
      )}

      <section aria-labelledby="bd-brand">
        <h3 id="bd-brand" className="mb-1 text-sm font-semibold text-ink">
          {operator ? 'Phân bổ theo nhãn hàng (mã vạch)' : `Phần của ${t.brand[state.brandView]} trong lô`}
        </h3>
        <p className="mb-2 text-xs text-muted">Theo mã vạch và khối lượng ước tính. Khối lượng cân không chia theo nhãn hàng.</p>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[420px]">
            <thead>
              <tr>
                <th>Nhãn hàng</th>
                <th className="text-right">Chai</th>
                <th className="text-right">kg ước tính</th>
                <th className="text-right">Tỷ trọng</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((x) => (
                <tr key={x.b}>
                  <td>{t.brand[x.b]}</td>
                  <td className="tnum text-right">{n0(x.bottles)}</td>
                  <td className="tnum text-right">{n3(x.estKg)}</td>
                  <td className="tnum text-right">{n1(x.sharePct)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="bd-sources">
        <h3 id="bd-sources" className="mb-2 text-sm font-semibold text-ink">
          Nguồn thu gom
        </h3>
        {cols.length === 0 ? (
          <p className="text-sm text-muted">Chưa có.</p>
        ) : (
          <ul className="divide-y divide-line rounded border border-line">
            {cols.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <a href={`#hub-station-${c.stationId}`} className="id-tag font-semibold text-ink hover:underline">
                    {c.stationId}
                  </a>{' '}
                  <span className="text-muted">· {c.driver}</span>
                </span>
                <span className="tnum text-ink-2">
                  {dateTime(c.ts)} · {n0(c.bottleCount)} chai · {kg(c.estimatedKg, 2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="bd-evidence">
        <h3 id="bd-evidence" className="mb-2 text-sm font-semibold text-ink">
          Tài liệu kèm theo ({batch.evidence.length})
        </h3>
        <ul className="divide-y divide-line rounded border border-line">
          {batch.evidence.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Icon name="file" size={14} className="text-muted" />
                  {t.hub.trace.evKinds[e.kind]}
                </span>
                <span className="block truncate font-mono text-[11px] text-muted">
                  {e.fileName}
                  {e.sizeBytes ? ` · ${n0(e.sizeBytes / 1024)} KB` : ''}
                </span>
              </span>
              <span className="text-right text-xs text-muted">
                <span className="tnum">{dateTime(e.ts)}</span>
                <br />
                {e.origin === 'generated' ? 'Do bản mẫu tạo' : 'Người vận hành đính kèm'}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ReportView({ args }: { args: ReportArgs }) {
  return (
    <article className="mt-2 rounded border border-line bg-white p-4 text-[13px]" aria-label={args.title}>
      <header className="border-b border-ink pb-3">
        <div className="eyebrow">RE · {args.role}</div>
        <h4 className="text-base font-semibold text-ink">{args.title}</h4>
        <div className="mt-1 grid gap-0.5 text-xs text-ink-2">
          <div>
            <b>Kỳ:</b> {args.period}
          </div>
          <div>
            <b>Bộ lọc:</b> {args.filters}
          </div>
          <div>{args.units}</div>
          <div className="text-muted">Tạo lúc {args.generated}</div>
        </div>
      </header>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Chai được nhận', n0(args.totals.acceptedBottles)],
          ['kg theo bản ghi', n3(args.totals.acceptedKg)],
          ['Vật phẩm trả lại', n0(args.totals.rejected)],
          ['Tỷ lệ trả lại (%)', n1(args.totals.rejectionRatePct)],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-xs text-muted">{l}</div>
            <div className="tnum font-semibold">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="table-base min-w-[720px]">
          <thead>
            <tr>
              <th>Lô</th>
              <th>Trạng thái</th>
              <th className="text-right">Ước tính (kg)</th>
              <th className="text-right">Đã cân (kg)</th>
              <th className="text-right">Chênh lệch</th>
              <th className="text-right">Hạ nguồn (kg)</th>
              <th>Bằng chứng</th>
            </tr>
          </thead>
          <tbody>
            {args.batches.map((b) => (
              <tr key={b.id}>
                <td className="id-tag">{b.id}</td>
                <td>{b.status}</td>
                <td className="tnum text-right">{n3(b.est)}</td>
                <td className="tnum text-right">{b.measured === null ? '—' : n3(b.measured)}</td>
                <td className="tnum text-right">{b.disc === null ? '—' : `${signed(b.disc)} / ${signed(b.discPct ?? 0, 1)} %`}</td>
                <td className="tnum text-right">{b.downstream === null ? 'Chưa có' : n3(b.downstream)}</td>
                <td className="text-xs">{b.evidence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 border-t border-line pt-3 text-xs font-medium text-ink">{args.disclaimer}</p>
    </article>
  );
}
