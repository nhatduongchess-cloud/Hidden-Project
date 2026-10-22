import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useAppState } from '../../lib/store-context';
import { totals, userBalances, EMPTY_FILTERS, type TxFilters } from '../../domain/selectors';
import { filteredTxRows, transactionsCsv } from '../../domain/report';
import type { BrandId, Material, Transaction } from '../../domain/types';
import { dateTime, isoDay, n0, n1, n2 } from '../../lib/format';
import { Badge, Button, DemoTag, EmptyState, EstimateTag, Metric, SelectField, Tabs } from '../../components/ui';
import { PageHeader, Panel, offerFile } from './shared';

type Status = 'all' | Transaction['status'] | 'pending';

const MATERIALS: Material[] = ['PET_CLEAR', 'PET_COLORED', 'HDPE', 'GLASS', 'METAL_CAN', 'UNKNOWN_OBJECT'];
const BRANDS: BrandId[] = ['BRAND_A', 'BRAND_B', 'BRAND_C', 'UNKNOWN'];

export function describeFilters(f: TxFilters, state: ReturnType<typeof useAppState>, t: ReturnType<typeof useT>): string {
  return [
    `Trạm: ${f.stationId === 'all' ? 'tất cả' : f.stationId}`,
    `Từ: ${f.from || '—'}`,
    `Đến: ${f.to || '—'}`,
    `Vật liệu: ${f.material === 'all' ? 'tất cả' : t.material[f.material]}`,
    `Nhãn hàng: ${state.role === 'brand' ? t.brand[state.brandView] : f.brand === 'all' ? 'tất cả' : t.brand[f.brand]}`,
  ].join(' · ');
}

export function TxFilterBar({ f, setF, idPrefix }: { f: TxFilters; setF: (f: TxFilters) => void; idPrefix: string }) {
  const t = useT();
  const state = useAppState();
  const dirty = JSON.stringify(f) !== JSON.stringify(EMPTY_FILTERS);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
      <SelectField
        id={`${idPrefix}-station`}
        label="Trạm"
        value={f.stationId}
        onChange={(v) => setF({ ...f, stationId: v })}
        options={[{ value: 'all', label: 'Tất cả trạm' }, ...state.stations.map((s) => ({ value: s.id, label: `${s.id} · ${s.name}` }))]}
      />
      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-from`} className="field-label">
          Từ ngày
        </label>
        <input id={`${idPrefix}-from`} type="date" className="input tnum" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} />
      </div>
      <div className="min-w-0">
        <label htmlFor={`${idPrefix}-to`} className="field-label">
          Đến ngày
        </label>
        <input id={`${idPrefix}-to`} type="date" className="input tnum" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      <SelectField
        id={`${idPrefix}-material`}
        label="Vật liệu"
        value={f.material}
        onChange={(v) => setF({ ...f, material: v as Material | 'all' })}
        options={[{ value: 'all', label: 'Tất cả vật liệu' }, ...MATERIALS.map((m) => ({ value: m, label: t.material[m] }))]}
      />
      {state.role === 'operator' ? (
        <SelectField
          id={`${idPrefix}-brand`}
          label="Nhãn hàng (theo mã vạch)"
          value={f.brand}
          onChange={(v) => setF({ ...f, brand: v as BrandId | 'all' })}
          options={[{ value: 'all', label: 'Tất cả nhãn hàng' }, ...BRANDS.map((b) => ({ value: b, label: t.brand[b] }))]}
        />
      ) : (
        <div className="min-w-0">
          <div className="field-label">Nhãn hàng</div>
          <div className="input flex items-center bg-sunk text-ink-2">{t.brand[state.brandView]}</div>
        </div>
      )}
      <div className="flex items-end">
        <Button variant="ghost" onClick={() => setF(EMPTY_FILTERS)} disabled={!dirty}>
          Xóa lọc
        </Button>
      </div>
    </div>
  );
}

export function Transactions() {
  const t = useT();
  const state = useAppState();
  const [f, setF] = useState<TxFilters>(EMPTY_FILTERS);
  const [status, setStatus] = useState<Status>('all');
  const [limit, setLimit] = useState(50);
  const base = useMemo(() => filteredTxRows(state, f), [state, f]);
  const rows = useMemo(
    () => base.filter((x) => (status === 'all' ? true : status === 'pending' ? x.sync === 'pending' : x.status === status)).sort((a, b) => b.ts - a.ts),
    [base, status],
  );
  const tot = useMemo(() => totals(base), [base]);
  const balances = userBalances(state);
  const operator = state.role === 'operator';

  return (
    <>
      <PageHeader
        title="Giao dịch"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            {operator ? 'Mọi lượt bỏ chai ở các trạm' : `Lượt bỏ chai có mã vạch của ${t.brand[state.brandView]}`} <DemoTag />
          </span>
        }
        actions={
          <Button icon="download" onClick={() => offerFile(`re-giao-dich-${isoDay(Date.now())}.csv`, transactionsCsv(state, f), 'text/csv')}>
            Xuất CSV
          </Button>
        }
      />

      <Panel title="Bộ lọc">
        <TxFilterBar f={f} setF={(x) => (setF(x), setLimit(50))} idPrefix="tx" />
        <p className="mt-3 text-xs text-muted">“Không rõ nhãn hàng” dùng khi mã vạch không có trong danh mục; hệ thống không đoán nhãn hàng.</p>
      </Panel>

      <div className="mt-5 grid grid-cols-2 gap-4 rounded-lg border border-line bg-panel p-4 md:grid-cols-4">
        <Metric size="sm" label="Chai được nhận" value={n0(tot.acceptedBottles)} unit="chai" />
        <Metric size="sm" label="Khối lượng PET" value={n2(tot.acceptedKg)} unit="kg" sub={<EstimateTag>Theo bản ghi</EstimateTag>} />
        <Metric size="sm" label="Trả lại" value={n0(tot.rejected)} sub={`${n1(tot.rejectionRatePct)} % số lượt`} />
        <Metric size="sm" label="Điểm đã ghi nhận" value={n0(tot.points)} unit="điểm" sub={tot.pendingPoints ? `+${n0(tot.pendingPoints)} chờ đồng bộ` : undefined} />
      </div>

      <div className="mt-5">
        <Tabs
          label="Trạng thái giao dịch"
          value={status}
          onChange={(v) => (setStatus(v), setLimit(50))}
          items={[
            { value: 'all', label: 'Tất cả', count: base.length },
            { value: 'accepted', label: 'Đã nhận', count: base.filter((x) => x.status === 'accepted').length },
            { value: 'rejected', label: 'Trả lại', count: base.filter((x) => x.status === 'rejected').length },
            { value: 'aborted', label: 'Bị dừng', count: base.filter((x) => x.status === 'aborted').length },
            { value: 'pending', label: 'Chờ đồng bộ', count: base.filter((x) => x.sync === 'pending').length },
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="filter" title="Không có giao dịch khớp bộ lọc" action={<Button onClick={() => (setF(EMPTY_FILTERS), setStatus('all'))}>Xóa lọc</Button>} />
        </div>
      ) : (
        <div className="card mt-4 min-w-0">
          <div className="overflow-x-auto">
            <table className="table-base min-w-[880px]" aria-describedby="tx-count">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Trạm</th>
                  <th>Người dùng</th>
                  <th>Vật liệu</th>
                  <th>Nhãn hàng</th>
                  <th>Kết quả</th>
                  <th className="text-right">PET (g)</th>
                  <th className="text-right">Điểm</th>
                  <th>Đồng bộ</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((x) => (
                  <tr key={x.id} data-txid={x.id}>
                    <td className="tnum whitespace-nowrap">{dateTime(x.ts)}</td>
                    <td className="id-tag">{x.stationId}</td>
                    <td className="id-tag whitespace-nowrap text-ink-2">{x.userId}</td>
                    <td>{t.material[x.material]}</td>
                    <td className="text-ink-2">{t.brand[x.brand]}</td>
                    <td>
                      <Badge tone={x.status === 'accepted' ? 'forest' : x.status === 'rejected' ? 'amber' : 'fault'} icon={x.status === 'accepted' ? 'check' : x.status === 'rejected' ? 'arrowLeft' : 'stop'}>
                        {t.txStatus[x.status]}
                      </Badge>
                      {x.reason && <div className="mt-0.5 text-xs text-muted">{t.reason[x.reason]}</div>}
                    </td>
                    <td className="tnum text-right">{x.acceptedMassG || '—'}</td>
                    <td className="tnum text-right">{x.points || '—'}</td>
                    <td>
                      {x.sync === 'pending' ? (
                        <Badge tone="slate" icon="sync">
                          Chờ đồng bộ
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted">Đã đồng bộ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5 text-xs text-muted">
            <span id="tx-count">
              Hiển thị {n0(Math.min(limit, rows.length))} / {n0(rows.length)} giao dịch. CSV gồm mọi giao dịch khớp bộ lọc.
            </span>
            {limit < rows.length && (
              <Button size="sm" variant="ghost" onClick={() => setLimit(limit + 50)}>
                Xem thêm 50 dòng
              </Button>
            )}
          </div>
        </div>
      )}

      {operator && (
        <Panel title="Điểm thưởng theo người dùng" className="mt-5" pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[520px]">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th className="text-right">Chai được nhận</th>
                  <th className="text-right">Điểm đã ghi nhận</th>
                  <th className="text-right">Điểm chờ đồng bộ</th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((u) => {
                  const b = balances.get(u.id)!;
                  return (
                    <tr key={u.id}>
                      <td>
                        {u.label} <span className="id-tag text-xs text-muted">{u.id}</span>
                      </td>
                      <td className="tnum text-right">{n0(b.bottles)}</td>
                      <td className="tnum text-right">{n0(b.credited)}</td>
                      <td className={`tnum text-right ${b.pending ? 'font-medium text-slate' : ''}`}>{n0(b.pending)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">{t.hub.tx.rewardsNote(state.settings.pointsPerBottle)}</p>
        </Panel>
      )}
    </>
  );
}
