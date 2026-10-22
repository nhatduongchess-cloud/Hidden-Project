import { useMemo, useState } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { forecastStation, type Forecast } from '../../domain/forecast';
import { Badge, DemoTag, SelectField } from '../../components/ui';
import { Icon } from '../../components/icons';
import { n0, n1 } from '../../lib/format';
import { PageHeader, Panel } from './shared';

export const forecastTime = (ts: number) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(ts);

function ForecastLine({ forecast: f, horizon, warn, stop }: { forecast: Forecast; horizon: number; warn: number; stop: number }) {
  const x = (ts: number) => 40 + ((ts - f.points[0].ts) / (horizon * 3_600_000)) * 560;
  const y = (pct: number) => 176 - Math.min(100, pct) * 1.45;
  const path = f.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.ts)},${y(p.pct)}`).join(' ');
  return (
    <svg
      viewBox="0 0 640 210"
      className="w-full"
      role="img"
      aria-label={`Dự báo mức đầy từ ${n0(f.currentPct)} đến ${n0(f.points.at(-1)!.pct)} phần trăm trong ${horizon} giờ`}
    >
      {[0, 50, warn, stop].map((p) => (
        <g key={p}>
          <line
            x1="40"
            x2="600"
            y1={y(p)}
            y2={y(p)}
            stroke={p === warn ? '#b37314' : p === stop ? '#c34239' : '#dae4e0'}
            strokeDasharray={p >= warn ? '5 5' : undefined}
          />
          <text x="32" y={y(p) + 4} textAnchor="end" fontSize="11" fill="#586b64">
            {p}%
          </text>
        </g>
      ))}
      <path d={`${path} L600,176 L40,176 Z`} fill="#e4f3ec" opacity=".65" />
      <path d={path} fill="none" stroke="#197c60" strokeWidth="3" />
      <circle cx="40" cy={y(f.currentPct)} r="4" fill="#197c60" />
      {[0, horizon / 2, horizon].map((h) => (
        <text
          key={h}
          x={40 + (h / horizon) * 560}
          y="200"
          textAnchor={h === 0 ? 'start' : h === horizon ? 'end' : 'middle'}
          fontSize="11"
          fill="#586b64"
        >
          {h === 0 ? 'Hiện tại' : `+${h} giờ`}
        </text>
      ))}
    </svg>
  );
}

export function Forecasts() {
  const state = useAppState(),
    store = useStore();
  const [horizon, setHorizon] = useState('48');
  const [now] = useState(Date.now);
  const rows = useMemo(
    () =>
      state.stations
        .map((st) => ({ st, f: forecastStation(state, st, now, Number(horizon)) }))
        .sort((a, b) => (a.f.reaches80At ?? Infinity) - (b.f.reaches80At ?? Infinity) || b.f.currentPct - a.f.currentPct),
    [state, now, horizon],
  );
  return (
    <>
      <PageHeader
        title="Dự báo mức đầy"
        sub="Biết trạm nào cần ghé trước chuyến tiếp theo."
        actions={
          <a href="#hub-routes" className="btn btn-primary">
            <Icon name="route" size={17} />
            Lập tuyến thu gom
          </a>
        }
      />
      <div className="ops-note mb-5">
        <Icon name="info" size={18} />
        <p>
          Dự báo từ bản ghi đã đồng bộ, theo giờ trong ngày và ngày trong tuần. Khung giờ mở cửa được tính vào thời điểm đầy.{' '}
          <strong>Kết quả hiện được tính từ dữ liệu mẫu.</strong>
        </p>
      </div>
      <div className="card mb-5 grid gap-4 p-4 sm:grid-cols-[180px_280px_1fr]">
        <SelectField
          id="forecast-horizon"
          label="Khoảng dự báo"
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: '24', label: '24 giờ tới' },
            { value: '48', label: '48 giờ tới' },
            { value: '72', label: '72 giờ tới' },
          ]}
        />
        <SelectField
          id="forecast-season"
          label="Kịch bản nhu cầu"
          value={String(state.settings.demandMultiplier ?? 1)}
          onChange={(v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { demandMultiplier: Number(v) } })}
          options={[
            { value: '1', label: 'Bình thường · theo lịch sử' },
            { value: '0.6', label: 'Mùa thi / nghỉ · giả định −40%' },
            { value: '1.4', label: 'Cao điểm · giả định +40%' },
          ]}
        />
        <p className="self-center text-xs text-muted">
          Kịch bản cũng áp dụng khi lập tuyến. Hệ số mùa thi do người vận hành lựa chọn, chưa được suy ra từ dữ liệu.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        {rows.map(({ st, f }) => (
          <Panel
            key={st.id}
            title={
              <a href={`#hub-station-${st.id}`} className="hover:underline">
                {st.id} · {st.name}
              </a>
            }
            actions={
              <Badge tone={f.currentPct >= state.settings.stopPct ? 'fault' : f.reaches80At !== null ? 'amber' : 'forest'}>
                {f.currentPct >= state.settings.stopPct ? 'Đã dừng nhận chai' : f.reaches80At !== null ? 'Cần lên lịch' : 'Còn sức chứa'}
              </Badge>
            }
          >
            <div className="flex items-end justify-between gap-4">
              <div>
                <span className="text-xs text-muted">Mức đầy đã ghi nhận</span>
                <div className="text-3xl font-semibold tnum">
                  {n0(f.currentPct)}
                  <span className="text-lg text-muted">%</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted">Dự kiến đạt {state.settings.warnPct}%</span>
                <div className="font-semibold text-forest">
                  {f.currentPct >= state.settings.warnPct
                    ? 'Đã đạt ngưỡng'
                    : f.paused
                      ? 'Tạm ngừng dự báo'
                      : f.reaches80At
                        ? forecastTime(f.reaches80At)
                        : `Chưa đạt trong ${horizon} giờ`}
                </div>
              </div>
            </div>
            <ForecastLine forecast={f} horizon={Number(horizon)} warn={state.settings.warnPct} stop={state.settings.stopPct} />
            <dl className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
              <div>
                <dt className="text-muted">Cơ sở dự báo</dt>
                <dd className="mt-1 font-medium">
                  {f.model.source === 'history'
                    ? `${f.model.days} ngày · ${n0(f.model.samples)} chai`
                    : `Tốc độ giả định ${st.forecastRateBph} chai/giờ`}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{f.model.source === 'history' ? 'Giờ nhận nhiều nhất (GMT+7)' : 'Lịch sử chưa đủ'}</dt>
                <dd className="mt-1 font-medium">
                  {f.model.source === 'history'
                    ? `${String(f.model.peakHour).padStart(2, '0')}:00–${String(f.model.peakHour + 1).padStart(2, '0')}:00`
                    : 'Cần ≥ 7 ngày và 30 chai'}
                </dd>
              </div>
            </dl>
            {f.stale && (
              <p className="mt-3 rounded bg-slate-tint p-2 text-xs text-slate">
                Dữ liệu cũ · lần đọc {forecastTime(st.lastUpdate)}. Mức đầy thực tế có thể cao hơn.
              </p>
            )}
            {f.paused && <p className="mt-3 text-xs text-fault-ink">Trạm đang lỗi; dự báo giữ nguyên mức đầy cho đến khi xử lý.</p>}
            <p className="mt-3 text-xs text-muted">
              Sau {horizon} giờ: ≈ {n1(f.points.at(-1)!.pct)}% · Không giả định có lượt thu gom giữa kỳ.
            </p>
          </Panel>
        ))}
        <Panel title="Đọc dự báo để quyết định">
          <div className="flex flex-col gap-4 text-sm">
            <p>
              <strong className="text-fault-ink">Từ {state.settings.stopPct}%:</strong> trạm tự dừng nhận chai, ưu tiên thu gom cao nhất.
            </p>
            <p>
              <strong className="text-amber-ink">Từ {state.settings.warnPct}% hoặc sắp đạt ngưỡng:</strong> đưa vào danh sách bắt buộc trước
              chuyến kế tiếp.
            </p>
            <p>
              <strong className="text-forest">Từ 50%:</strong> cân nhắc ghé thêm khi gần tuyến, xe còn tải và còn thời gian.
            </p>
            <p className="border-t border-line pt-4 text-xs text-muted">
              Mô hình làm trơn lịch sử, không phải cam kết thời điểm đầy. Các ngày ít giao dịch do mất kết nối hoặc thùng đầy có thể khiến
              dự báo thấp hơn nhu cầu thật. Thời gian hiển thị theo Việt Nam (GMT+7).
            </p>
            <DemoTag>Dự báo từ dữ liệu mẫu</DemoTag>
          </div>
        </Panel>
      </div>
    </>
  );
}
