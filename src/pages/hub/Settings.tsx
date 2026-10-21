import { useState } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { binCapacityKg } from '../../domain/constants';
import { kg, n0 } from '../../lib/format';
import { Icon, type IconName } from '../../components/icons';
import { Badge, Button, DemoTag, Dialog, NumberField, toast } from '../../components/ui';
import { PageHeader, Panel } from './shared';
import { RoadMap } from '../../components/LazyRoadMap';
import { collectTargets } from '../../domain/places';
import { placeMarkers } from '../driver/shared';
import { AreaSelect } from '../../components/AreaSelect';
import { areaById } from '../../domain/areas';

const INTEGRATIONS: { name: string; icon: IconName; now: string; later: string }[] = [
  { name: 'Dữ liệu từ trạm', icon: 'station', now: 'Mô phỏng trong trình duyệt', later: 'Trạm gửi qua 4G, ghi tạm khi mất mạng' },
  { name: 'Lưu trữ', icon: 'layers', now: 'Bộ nhớ trình duyệt này', later: 'Cơ sở dữ liệu có phân quyền theo vai trò' },
  { name: 'Lập tuyến', icon: 'route', now: 'Thời gian lái xe từ Valhalla/OSRM (máy chủ OSM công cộng); dự phòng đường thẳng', later: 'Máy chủ định tuyến riêng, giờ cấm tải và kẹt xe theo giờ' },
  { name: 'Bản đồ', icon: 'map', now: 'Bản đồ nền OpenStreetMap (máy chủ OSM, dự phòng OSM France); vị trí trạm minh họa', later: 'Vị trí trạm thật sau khảo sát thí điểm' },
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
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">Khung giờ dùng cho lập tuyến và dự báo. Tốc độ chai/giờ là phương án dự phòng khi chưa đủ 7 ngày và 30 chai lịch sử.</p>
        </Panel>

        <MapPlaces />

        <Panel title="Kết nối hệ thống" className="lg:col-span-2" pad={false}>
          <ul className="divide-y divide-line">
            {INTEGRATIONS.map((i) => (
              <li key={i.name} className="grid gap-2 px-4 py-3 sm:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                <span className="flex items-center gap-2 font-medium text-ink">
                  <Icon name={i.icon} size={17} className="text-muted" />
                  {i.name}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  {i.name === 'Lập tuyến' || i.name === 'Bản đồ' ? (
                    <Badge tone="info" icon="link">
                      Dịch vụ công cộng
                    </Badge>
                  ) : (
                    <Badge tone="slate" icon={i.now === 'Chưa có' ? 'x' : 'sliders'}>
                      {i.now === 'Chưa có' ? 'Chưa kết nối' : 'Mô phỏng'}
                    </Badge>
                  )}
                  {i.now !== 'Chưa có' && i.now}
                </span>
                <span className="text-xs text-muted">Dự kiến: {i.later}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
            Không có máy chủ RE, tài khoản hay khóa API. Chỉ bản đồ và định tuyến gọi máy chủ công cộng: trình duyệt tải ảnh bản đồ nền và gửi tọa độ trạm, bãi xe, vị trí xe tới Valhalla (FOSSGIS) hoặc OSRM. Không gửi giao dịch, người dùng hay số liệu trạm.
          </p>
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

/** Where stations, the depot and the receiving partner are, and the collection zone. */
function MapPlaces() {
  const state = useAppState();
  const store = useStore();
  const { zone, depot, partner } = state.settings;
  const area = areaById(state.settings.areaId);
  const [reset, setReset] = useState(false);
  const move = (target: string, lat: number, lng: number) => store.dispatch({ type: 'SET_LOCATION', target, lat, lng });
  const rows: { id: string; label: string; sub: string; lat: number; lng: number }[] = [
    ...state.stations.map((st) => ({ id: st.id, label: st.id, sub: st.name, lat: st.lat, lng: st.lng })),
    { id: 'DEPOT', label: 'Bãi xe', sub: depot.name, lat: depot.lat, lng: depot.lng },
    { id: 'PARTNER', label: 'Tiếp nhận', sub: partner.name, lat: partner.lat, lng: partner.lng },
  ];
  return (
    <Panel
      title="Vị trí trên bản đồ"
      className="lg:col-span-2"
      actions={
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => setReset(true)}>
          Đặt lại vị trí mặc định
        </Button>
      }
    >
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <AreaSelect id="hub-area" className="w-full max-w-[20rem]" />
        <p className="max-w-[62ch] flex-1 basis-[24rem] text-sm text-ink-2">
          Mỗi khu vực đặt ba trạm quanh một khu đại học, cùng bãi xe và điểm tiếp nhận trong thành phố. Đây là điểm minh họa, chưa phải địa điểm thí điểm. Kéo ghim trên bản đồ hoặc nhập tọa độ; thay đổi áp dụng ngay cho tuyến thu gom và màn hình tài xế.
        </p>
      </div>
      <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <RoadMap
          className="h-[380px] rounded border border-line"
          label="Bản đồ chỉnh vị trí trạm, bãi xe, điểm tiếp nhận và phạm vi thu gom. Ghim kéo được; tọa độ cũng nhập được trong bảng bên cạnh."
          markers={placeMarkers(state, collectTargets(state), { draggable: true })}
          zone={zone}
          fitKey={`settings|${area.id}`}
          onMarkerDrag={(id, p) => {
            move(id, p.lat, p.lng);
            toast(`Đã đặt lại vị trí ${id === 'DEPOT' ? 'bãi xe' : id === 'PARTNER' ? 'điểm tiếp nhận' : id}.`);
          }}
        />
        <div className="min-w-0">
          <div className="overflow-x-auto">
            <table className="table-base min-w-[420px]">
              <thead>
                <tr>
                  <th>Điểm</th>
                  <th>Vĩ độ</th>
                  <th>Kinh độ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="id-tag font-semibold">{r.label}</span>
                      <div className="max-w-[160px] truncate text-xs text-muted">{r.sub}</div>
                    </td>
                    <td className="w-[130px]">
                      <NumberField hideLabel id={`lat-${r.id}`} label={`Vĩ độ ${r.label}`} value={r.lat} min={8} max={24} step={0.0001} onChange={(v) => move(r.id, v, r.lng)} />
                    </td>
                    <td className="w-[130px]">
                      <NumberField hideLabel id={`lng-${r.id}`} label={`Kinh độ ${r.label}`} value={r.lng} min={102} max={110} step={0.0001} onChange={(v) => move(r.id, r.lat, v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
            <NumberField id="zone-r" label="Bán kính phạm vi" unit="km" value={zone.radiusKm} min={0.2} max={30} step={0.1} onChange={(v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { zone: { ...zone, radiusKm: v } } })} />
            <NumberField id="zone-lat" label="Tâm: vĩ độ" value={zone.lat} min={8} max={24} step={0.0001} onChange={(v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { zone: { ...zone, lat: v } } })} />
            <NumberField id="zone-lng" label="Tâm: kinh độ" value={zone.lng} min={102} max={110} step={0.0001} onChange={(v) => store.dispatch({ type: 'UPDATE_SETTINGS', patch: { zone: { ...zone, lng: v } } })} />
          </div>
          <p className="mt-2 text-xs text-muted">Trạm ngoài phạm vi không được xếp vào danh sách trạm gần nhất của tài xế.</p>
        </div>
      </div>
      <Dialog
        open={reset}
        onClose={() => setReset(false)}
        title="Đặt lại vị trí mặc định?"
        footer={
          <>
            <Button onClick={() => setReset(false)}>Hủy</Button>
            <Button
              variant="primary"
              onClick={() => {
                store.dispatch({ type: 'RESET_LOCATIONS' });
                setReset(false);
                toast('Đã đặt lại vị trí trạm, bãi xe, điểm tiếp nhận và phạm vi.');
              }}
            >
              Đặt lại
            </Button>
          </>
        }
      >
        Vị trí ba trạm, bãi xe, điểm tiếp nhận và phạm vi thu gom trở về điểm minh họa ban đầu của khu vực {area.city}. Xe được đưa về bãi.
      </Dialog>
    </Panel>
  );
}
