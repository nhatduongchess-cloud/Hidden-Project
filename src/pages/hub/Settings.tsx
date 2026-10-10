import { useState } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { binCapacityKg } from '../../domain/constants';
import { kg, n0 } from '../../lib/format';
import { Icon, type IconName } from '../../components/icons';
import { Badge, Button, DemoTag, Dialog, NumberField, toast } from '../../components/ui';
import { PageHeader, Panel } from './shared';

const INTEGRATIONS: { name: string; icon: IconName; now: string; later: string }[] = [
  { name: 'Dữ liệu từ trạm', icon: 'station', now: 'Mô phỏng trong trình duyệt', later: 'Trạm gửi qua 4G, ghi tạm khi mất mạng' },
  { name: 'Lưu trữ', icon: 'layers', now: 'Bộ nhớ trình duyệt này', later: 'Cơ sở dữ liệu có phân quyền theo vai trò' },
  { name: 'Lập tuyến', icon: 'route', now: 'Heuristic trên ma trận khoảng cách giả lập', later: 'Khoảng cách đường thực và khung giờ cấm tải' },
  { name: 'Bản đồ', icon: 'map', now: 'Sơ đồ khuôn viên minh họa', later: 'Bản đồ nền và vị trí trạm thật' },
  { name: 'Đổi điểm', icon: 'gift', now: 'Chưa có', later: 'Đối tác ưu đãi, chưa thỏa thuận' },
  { name: 'Bên tái chế', icon: 'building', now: 'Tài liệu do người vận hành đính kèm', later: 'Nhận phiếu cân và chứng từ trực tiếp' },
];

export function HubSettings() {
  const state = useAppState();
  const store = useStore();
  const s = state.settings;
  const [reset, setReset] = useState(false);
  const set = (patch: Partial<typeof s>) => store.dispatch({ type: 'UPDATE_SETTINGS', patch });

  return (
    <>
      <PageHeader
        title="Cài đặt"
        sub={
          <span className="inline-flex flex-wrap items-center gap-2">
            Giả định của bản mẫu. Thay đổi áp dụng cho mọi màn hình. <DemoTag />
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Điểm thưởng">
          <NumberField id="set-points" label="Điểm mỗi chai hợp lệ" unit="điểm" value={s.pointsPerBottle} min={0} max={1000} step={1} onChange={(v) => set({ pointsPerBottle: v })} hint="Áp dụng cho chai nhận từ bây giờ. Giao dịch cũ giữ số điểm đã ghi. Điểm không có giá trị tiền tệ." />
        </Panel>

        <Panel title="Nhận diện chai">
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="set-conf" label="Ngưỡng tin cậy camera" unit="%" value={s.confidenceThresholdPct} min={50} max={99} step={1} onChange={(v) => set({ confidenceThresholdPct: v })} hint="Mã vạch trong danh mục hạ ngưỡng 20 điểm." />
            <NumberField id="set-liquid" label="Dung sai chất lỏng" unit="g" value={s.liquidToleranceG} min={0} max={100} step={1} onChange={(v) => set({ liquidToleranceG: v })} hint="Nặng hơn chai rỗng quá mức này thì trả lại." />
          </div>
        </Panel>

        <Panel title="Thùng chứa và mức đầy">
          <div className="grid grid-cols-2 gap-3">
            <NumberField id="set-mass" label="Khối lượng một chai PET" unit="g" value={s.avgBottleMassG} min={5} max={80} step={1} onChange={(v) => set({ avgBottleMassG: v })} hint="Giả định từ đề xuất, chưa kiểm chứng." />
            <NumberField id="set-density" label="Mật độ PET đã cán" unit="kg/m³" value={s.compactedDensityKgM3} min={10} max={200} step={1} onChange={(v) => set({ compactedDensityKgM3: v })} hint="Cận dưới 30–39 kg/m³ theo US EPA; rulo RE chưa thử." />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted">Thể tích thùng</dt>
              <dd className="tnum font-semibold text-ink">0,24 m³</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Sức chứa ước tính</dt>
              <dd className="tnum font-semibold text-ink">{kg(binCapacityKg(s), 1)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Ngưỡng</dt>
              <dd className="tnum font-semibold text-ink">
                {s.warnPct} % · {s.stopPct} %
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">Ngưỡng cố định theo thiết kế: 80 % đưa trạm vào danh sách thu gom, 95 % trạm tự dừng nhận chai.</p>
        </Panel>

        <Panel title="Trạm" pad={false}>
          <div className="overflow-x-auto">
            <table className="table-base min-w-[480px]">
              <thead>
                <tr>
                  <th>Trạm</th>
                  <th>Mở</th>
                  <th>Đóng</th>
                  <th>Chai/giờ (giả định)</th>
                </tr>
              </thead>
              <tbody>
                {state.stations.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <span className="id-tag font-semibold">{st.id}</span>
                      <div className="text-xs text-muted">{st.name}</div>
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`win-s-${st.id}`}>
                        Giờ mở {st.id}
                      </label>
                      <input
                        id={`win-s-${st.id}`}
                        type="time"
                        className="input tnum w-[112px]"
                        value={st.accessWindow.start}
                        onChange={(e) => e.target.value && store.dispatch({ type: 'UPDATE_STATION', stationId: st.id, patch: { accessWindow: { ...st.accessWindow, start: e.target.value } } })}
                      />
                    </td>
                    <td>
                      <label className="sr-only" htmlFor={`win-e-${st.id}`}>
                        Giờ đóng {st.id}
                      </label>
                      <input
                        id={`win-e-${st.id}`}
                        type="time"
                        className="input tnum w-[112px]"
                        value={st.accessWindow.end}
                        onChange={(e) => e.target.value && store.dispatch({ type: 'UPDATE_STATION', stationId: st.id, patch: { accessWindow: { ...st.accessWindow, end: e.target.value } } })}
                      />
                    </td>
                    <td className="w-[140px]">
                      <NumberField
                        id={`rate-${st.id}`}
                        label={`Chai mỗi giờ ${st.id}`}
                        value={st.forecastRateBph}
                        min={0}
                        max={200}
                        step={1}
                        onChange={(v) => store.dispatch({ type: 'UPDATE_STATION', stationId: st.id, patch: { forecastRateBph: v } })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Khung giờ dùng khi lập tuyến. Tốc độ chai/giờ chỉ dùng cho dự báo, không phải số liệu đo.</p>
        </Panel>

        <Panel title="Kết nối hệ thống" className="lg:col-span-2" pad={false}>
          <ul className="divide-y divide-line">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="grid gap-2 px-4 py-3 sm:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <Icon name={i.icon} size={17} className="text-muted" />
                  {i.name}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  <Badge tone="slate" icon={i.now === 'Chưa có' ? 'x' : 'sliders'}>
                    {i.now === 'Chưa có' ? 'Chưa kết nối' : 'Mô phỏng'}
                  </Badge>
                  {i.now !== 'Chưa có' && i.now}
                </span>
                <span className="text-xs text-muted">Dự kiến: {i.later}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Bản mẫu không gửi dữ liệu ra ngoài trình duyệt. Không có máy chủ, tài khoản hay khóa API nào được dùng.</p>
        </Panel>

        <Panel title="Dữ liệu demo" className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-[60ch] text-sm text-ink-2">
              {n0(state.transactions.length)} giao dịch, {state.batches.length} lô, {state.tasks.length} yêu cầu, {state.routes.length} tuyến. Dữ liệu là hư cấu và chỉ lưu trong trình duyệt này.
            </p>
            <Button variant="danger" icon="refresh" onClick={() => setReset(true)}>
              Khôi phục dữ liệu ban đầu
            </Button>
          </div>
        </Panel>
      </div>

      <Dialog
        open={reset}
        onClose={() => setReset(false)}
        title="Khôi phục dữ liệu demo?"
        footer={
          <>
            <Button onClick={() => setReset(false)}>Hủy</Button>
            <Button
              variant="danger"
              onClick={() => {
                store.reset();
                setReset(false);
                toast('Đã khôi phục dữ liệu demo ban đầu.');
              }}
            >
              Khôi phục
            </Button>
          </>
        }
      >
        Mọi giao dịch, tuyến, yêu cầu và hồ sơ tạo trong bản mẫu sẽ bị xóa.
      </Dialog>
    </>
  );
}
