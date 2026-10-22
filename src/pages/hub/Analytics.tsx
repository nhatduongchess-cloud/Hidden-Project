import { useMemo, useState } from 'react';
import { useAppState } from '../../lib/store-context';
import { useT } from '../../i18n';
import { filterTxs, EMPTY_FILTERS, totals, dailySeries, type TxFilters } from '../../domain/selectors';
import { groupCollections, operatingKpis } from '../../domain/analytics';
import { toCsv } from '../../domain/csv';
import { DailyBars, Breakdown } from '../../components/charts';
import { Button, DemoTag, Metric, NumberField, Segmented } from '../../components/ui';
import { n0, n1, n2, isoDay } from '../../lib/format';
import { TxFilterBar } from './Transactions';
import { PageHeader, Panel, offerFile, FilterBar, periodStart, useHubFilter } from './shared';

export function Analytics() {
  const state = useAppState(),
    t = useT();
  const [now] = useState(Date.now);
  const [filter, setFilter] = useState<TxFilters>({ ...EMPTY_FILTERS, from: isoDay(now - 13 * 86_400_000), to: isoDay(now) });
  const [unit, setUnit] = useState<'kg' | 'bottles'>('kg');
  const rows = useMemo(() => filterTxs(state, filter, { includePending: false }), [state, filter]);
  const total = totals(rows);
  const byStation = groupCollections(rows, (r) => r.stationId);
  const byBrand = groupCollections(rows, (r) => r.brand);
  const byMaterial = groupCollections(rows, (r) => r.material);
  const end = filter.to ? new Date(`${filter.to}T23:59:59`).getTime() : now;
  const start = filter.from ? new Date(`${filter.from}T00:00:00`).getTime() : rows.length ? Math.min(...rows.map((r) => r.ts)) : end;
  const days = Math.max(1, Math.min(90, Math.floor((end - start) / 86_400_000) + 1));
  const series = dailySeries(rows, days, end);
  const csv = () =>
    offerFile(
      `re-thong-ke-${isoDay(now)}.csv`,
      toCsv(
        ['Trạm', 'Chai được nhận', 'PET ước tính (kg)', 'Vật phẩm trả lại', 'Tỷ lệ từ chối (%)'],
        byStation.map((r) => [r.id, r.acceptedBottles, r.acceptedKg, r.rejected, r.rejectionRatePct]),
      ),
      'text/csv',
    );
  const colors = ['#197c60', '#4e79a7', '#d09c37', '#899992', '#785a9a', '#b06555'];
  return (
    <>
      <PageHeader
        title="Số lượng thu gom"
        sub="Từ mỗi lượt trả chai đến bức tranh toàn mạng lưới."
        actions={
          <Button icon="download" onClick={csv}>
            Xuất thống kê CSV
          </Button>
        }
      />
      <Panel title="Chọn dữ liệu cần xem">
        <TxFilterBar f={filter} setF={setFilter} idPrefix="analytics" />
        <p className="mt-3 text-xs text-muted">
          Chỉ gồm bản ghi đã đồng bộ. Loại chai theo kết quả nhận diện mô phỏng; nhãn hàng theo mã vạch.
        </p>
      </Panel>
      <div className="ops-metrics my-5">
        <div>
          <Metric label="Chai được nhận" value={n0(total.acceptedBottles)} unit="chai" />
          <span className="ops-metric-note">Tại các trạm trong bộ lọc</span>
        </div>
        <div>
          <Metric label="Khối lượng PET" value={n2(total.acceptedKg)} unit="kg" />
          <span className="ops-metric-note">Ước tính theo bản ghi trạm</span>
        </div>
        <div>
          <Metric label="Tỷ lệ từ chối" value={n1(total.rejectionRatePct)} unit="%" />
          <span className="ops-metric-note">{n0(total.rejected)} vật phẩm trả lại</span>
        </div>
        <div>
          <Metric label="Trạm có giao dịch" value={n0(byStation.length)} unit="trạm" />
          <span className="ops-metric-note">Trong khoảng đã chọn</span>
        </div>
      </div>
      <Panel
        title="Xu hướng theo ngày"
        actions={
          <Segmented
            name="analytics-unit"
            label="Đơn vị biểu đồ"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'kg', label: 'Khối lượng (kg)' },
              { value: 'bottles', label: 'Số chai' },
            ]}
          />
        }
      >
        <DailyBars
          data={series.map((d) => ({ ...d, kg: unit === 'kg' ? d.kg : d.bottles }))}
          unit={unit === 'kg' ? 'kg' : 'chai'}
          label={`Xu hướng ${unit === 'kg' ? 'khối lượng PET' : 'số chai'} theo ngày`}
        />
        <p className="mt-2 text-xs text-muted">
          Biểu đồ hiển thị tối đa 90 ngày cuối khoảng chọn. Các chỉ số và CSV dùng toàn bộ khoảng chọn.
        </p>
      </Panel>
      <div className="my-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Theo nhãn hàng (mã vạch)">
          {byBrand.length ? (
            <Breakdown
              items={byBrand.map((r, i) => ({
                label: t.brand[r.id as keyof typeof t.brand],
                value: unit === 'kg' ? r.acceptedKg : r.acceptedBottles,
                color: colors[i % colors.length],
              }))}
              unit={unit === 'kg' ? 'kg' : 'chai'}
            />
          ) : (
            <p className="text-sm text-muted">Không có giao dịch khớp bộ lọc.</p>
          )}
        </Panel>
        <Panel title="Theo loại chai (nhận diện)">
          {byMaterial.length ? (
            <Breakdown
              items={byMaterial.map((r, i) => ({
                label: t.material[r.id as keyof typeof t.material],
                value: unit === 'kg' ? r.acceptedKg : r.acceptedBottles,
                color: colors[i % colors.length],
              }))}
              unit={unit === 'kg' ? 'kg' : 'chai'}
            />
          ) : (
            <p className="text-sm text-muted">Không có giao dịch khớp bộ lọc.</p>
          )}
        </Panel>
      </div>
      <Panel title="Chi tiết theo trạm" pad={false} actions={<DemoTag />}>
        <div className="overflow-x-auto">
          <table className="table-base min-w-[580px]">
            <thead>
              <tr>
                <th>Trạm</th>
                <th className="text-right">Chai được nhận</th>
                <th className="text-right">PET (kg)</th>
                <th className="text-right">Từ chối</th>
                <th className="text-right">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {byStation.map((r) => (
                <tr key={r.id}>
                  <td>
                    <a href={`#hub-station-${r.id}`} className="font-semibold text-forest">
                      {r.id}
                    </a>
                    <div className="text-xs text-muted">{state.stations.find((s) => s.id === r.id)?.name}</div>
                  </td>
                  <td className="text-right tnum">{n0(r.acceptedBottles)}</td>
                  <td className="text-right tnum">{n2(r.acceptedKg)}</td>
                  <td className="text-right tnum">{n0(r.rejected)}</td>
                  <td className="text-right tnum">{n1(r.rejectionRatePct)}%</td>
                </tr>
              ))}
              {!byStation.length && (
                <tr>
                  <td colSpan={5}>Không có dữ liệu. Hãy đổi bộ lọc hoặc khoảng thời gian.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="mt-3 text-xs text-muted">
        Số chai đã nhận chưa đồng nghĩa với số chai đã thu khỏi trạm hoặc đã tái chế. Đối chiếu các bước trong{' '}
        <a href="#hub-trace" className="text-forest underline">
          Truy xuất & báo cáo EPR
        </a>
        .
      </p>
    </>
  );
}

export function Kpis() {
  const state = useAppState(),
    f = useHubFilter();
  const [costKm, setCostKm] = useState(6000),
    [costTrip, setCostTrip] = useState(50000);
  const now = Date.now(),
    from = periodStart(f.period, now);
  const k = operatingKpis(state, from, now, costKm, costTrip);
  const metrics = [
    {
      label: 'Chi phí / kg',
      value: k.costPerKg === null ? '—' : n0(k.costPerKg),
      unit: 'đ/kg',
      hint: 'Chi phí giả định ÷ kg đã thu trên tuyến hoàn tất',
      icon: 'scale',
    },
    {
      label: 'Hiệu suất thu gom',
      value: k.kgPerKm === null ? '—' : n2(k.kgPerKm),
      unit: 'kg/km',
      hint: 'Kg thực thu theo bản ghi ÷ km tuyến dự kiến',
      icon: 'truck',
    },
    {
      label: 'Mức đầy khi lấy',
      value: k.pickupPct === null ? '—' : n1(k.pickupPct),
      unit: '%',
      hint: `Trung bình ${k.pickups} lượt thay thùng trong kỳ`,
      icon: 'bin',
    },
    {
      label: 'Thời gian trạm đầy',
      value: n1(k.full.hours),
      unit: 'giờ-trạm',
      hint: `Tổng ${k.full.intervals} khoảng đầy có nhật ký`,
      icon: 'clock',
    },
    {
      label: 'Tỷ lệ chai bị từ chối',
      value: n1(k.rejectionRatePct),
      unit: '%',
      hint: 'Số lượt từ chối ÷ (được nhận + từ chối)',
      icon: 'bottle',
    },
  ];
  return (
    <>
      <PageHeader
        title="Hiệu quả vận hành"
        sub="Theo dõi chi phí, năng suất và thời gian gián đoạn trên toàn mạng lưới."
        actions={<FilterBar station={false} />}
      />
      <div className="ops-note mb-5">
        <p>
          <strong>KPI từ dữ liệu mẫu.</strong> Khối lượng lấy từ bản ghi thu gom; quãng đường là kế hoạch, chưa có công-tơ-mét thực tế. Chi phí
          bên dưới là giả định có thể thay đổi.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="card p-5">
            <Metric label={m.label} value={m.value} unit={m.unit} />
            <p className="mt-3 text-xs text-muted">{m.hint}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Giả định chi phí">
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              id="kpi-cost-km"
              label="Chi phí mỗi km"
              unit="đ/km"
              value={costKm}
              min={0}
              max={1000000}
              step={1000}
              onChange={setCostKm}
            />
            <NumberField
              id="kpi-cost-trip"
              label="Chi phí cố định mỗi chuyến"
              unit="đ"
              value={costTrip}
              min={0}
              max={10000000}
              step={10000}
              onChange={setCostTrip}
            />
          </div>
          <p className="mt-4 text-sm text-muted">
            Chi phí = quãng đường × chi phí mỗi km + số chuyến × chi phí cố định. Thay đổi giả định chỉ dùng để so sánh trong màn hình này.
          </p>
        </Panel>
        <Panel title="Dữ liệu dùng để tính">
          <dl className="ops-data-list">
            <div>
              <dt>Tuyến đã hoàn tất trong kỳ</dt>
              <dd>{k.routes}</dd>
            </div>
            <div>
              <dt>Khối lượng khớp lượt thay thùng</dt>
              <dd>{n2(k.matchedKg)} kg</dd>
            </div>
            <div>
              <dt>Quãng đường kế hoạch của tuyến</dt>
              <dd>{n1(k.km)} km</dd>
            </div>
            <div>
              <dt>Tổng chi phí giả định</dt>
              <dd>{n0(k.cost)} đ</dd>
            </div>
          </dl>
          {!k.routes && (
            <p className="mt-4 text-sm text-muted">
              Chưa có tuyến hoàn tất. Giao tuyến và xác nhận thay thùng trên màn hình tài xế để có dữ liệu kg/km và đồng/kg.
            </p>
          )}
          <a href="#hub-routes" className="btn btn-secondary mt-4">
            Mở tuyến thu gom
          </a>
        </Panel>
      </div>
      <p className="mt-4 text-xs text-muted">
        Thời gian đầy tính từ sự kiện đạt ngưỡng dừng đến lúc thay thùng, cắt theo kỳ báo cáo và cộng giữa các trạm. Thiếu nhật ký có thể
        làm thấp chỉ số; không suy diễn thời gian trạm đầy từ một lần đọc cảm biến.
      </p>
    </>
  );
}
