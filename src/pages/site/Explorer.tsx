import { useState } from 'react';
import { StationIllustration, ZONES, type ZoneId } from '../../components/StationIllustration';
import { Icon, type IconName } from '../../components/icons';
import { Badge, Segmented, OP_META } from '../../components/ui';
import cutaway from '../../assets/cutaway-34.webp';
import sensors from '../../assets/fill-sensors.webp';
import binSwap from '../../assets/bin-swap.webp';
import lobby from '../../assets/station-lobby.webp';
import sectionAA from '../../assets/section-aa.webp';

interface ZoneInfo {
  name: string;
  icon: IconName;
  summary: string;
  facts: [string, string][];
  notes: string[];
  image?: { src: string; alt: string };
}

const ZONE_INFO: Record<ZoneId, ZoneInfo> = {
  ui: {
    name: 'QR và màn hình',
    icon: 'qr',
    summary: 'Định danh người dùng và hướng dẫn từng bước. Khi trạm đầy hoặc có lỗi, màn hình nói rõ và không hiện mã QR.',
    facts: [
      ['Cao độ màn hình', '1.320 mm'],
      ['Thành phần', 'Màn hình cảm ứng, vùng quét QR, đèn trạng thái'],
      ['An toàn', 'Nút dừng khẩn cấp ở mặt trước'],
    ],
    notes: ['Người dùng quét mã trên màn hình bằng ứng dụng RE.'],
    image: { src: lobby, alt: 'Ảnh dựng: người dùng đứng trước màn hình trạm' },
  },
  inspection: {
    name: 'Khoang nhận diện',
    icon: 'camera',
    summary: 'Giữ đúng một chai trong khoang kín có đèn cố định. Camera, mã vạch và cân cùng quyết định nhận hay trả lại.',
    facts: [
      ['Cao độ khe nhận', '1.125 mm'],
      ['Cân', 'Load cell ≤ 1 kg dưới sàn rơi hai cánh'],
      ['Nhận diện', 'Camera + đèn LED, đầu đọc mã vạch, AI chạy tại trạm'],
    ],
    notes: ['Camera một mình không xác định chắc chắn loại nhựa; vì vậy luôn kết hợp mã vạch và cân.', 'Trường hợp không chắc chắn: trả chai lại cho người dùng.'],
    image: { src: sectionAA, alt: 'Mặt cắt A–A với khoang nhận diện ở giữa' },
  },
  flatten: {
    name: 'Rulo cán dẹt',
    icon: 'rollers',
    summary: 'Hai rulo có răng quay ngược chiều chọc thủng và cán dẹt chai. Rulo chỉ quay khi cửa ngoài đã đóng.',
    facts: [
      ['Khe cán', '15 mm'],
      ['Động cơ', '300 W, 40–50 Nm, ≈ 35 vòng/phút (chưa kiểm chứng)'],
      ['Xác nhận', 'Cảm biến xác nhận chai đã rơi qua rulo'],
    ],
    notes: ['Điểm chỉ được cộng sau tín hiệu xác nhận rơi, để chặn kiểu bỏ chai vào rồi rút ra.', 'Xử lý chai còn nắp là mục tiêu thiết kế, cần thử trên bàn trước.'],
    image: { src: cutaway, alt: 'Ảnh dựng cắt mở 3/4: cụm rulo kép phía trên thùng chứa' },
  },
  bin: {
    name: 'Thùng chứa tháo rời',
    icon: 'bin',
    summary: 'Một thùng xe đẩy nhận chai đã cán dẹt. Tài xế đổi thùng đầy lấy thùng rỗng tại trạm.',
    facts: [
      ['Thể tích', '≈ 0,24 m³'],
      ['Số thùng', 'Một thùng trong giai đoạn thí điểm'],
      ['Cửa', 'Có công tắc liên động'],
    ],
    notes: ['Không tách màu vật lý trong thí điểm. AI chỉ ghi loại chai (PET trong hoặc màu) vào dữ liệu.'],
    image: { src: binSwap, alt: 'Ảnh dựng: nhân viên kéo thùng chứa ra khỏi trạm' },
  },
  sensors: {
    name: 'Cảm biến mức đầy và khay hứng nước',
    icon: 'sensor',
    summary: 'Hai cảm biến siêu âm đo mức đầy thùng. Khay ở đáy hứng phần nước còn sót trong chai.',
    facts: [
      ['Cảm biến', '2 cảm biến siêu âm'],
      ['Ngưỡng', 'Cảnh báo 80 %, dừng nhận 95 %'],
      ['Khay', 'Hứng nước thừa; trạm không dùng nước'],
    ],
    notes: ['Ở 80 %, RE Hub đưa trạm vào danh sách cần thu gom. Ở 95 %, trạm tự dừng nhận.'],
    image: { src: sensors, alt: 'Ảnh dựng: hai chùm cảm biến siêu âm chiếu xuống thùng, vạch 80 % và 95 %' },
  },
};

const NAMES = Object.fromEntries(ZONES.map((z) => [z, ZONE_INFO[z].name])) as Record<ZoneId, string>;
const CUTAWAY_ONLY: ZoneId[] = ['flatten', 'sensors'];

export function Explorer() {
  const [view, setView] = useState<'exterior' | 'cutaway'>('cutaway');
  const [zone, setZone] = useState<ZoneId>('inspection');
  const [fill, setFill] = useState(62);
  const pick = (z: ZoneId) => {
    setZone(z);
    if (view === 'exterior' && CUTAWAY_ONLY.includes(z)) setView('cutaway');
  };
  const info = ZONE_INFO[zone];
  const op = fill >= 95 ? 'stopped' : fill >= 80 ? 'warning' : 'accepting';

  return (
    <div className="mx-auto max-w-content px-4 pb-16 pt-8 sm:px-6 md:pt-12">
      <div className="max-w-[68ch]">
        <div className="eyebrow mb-2">Khám phá trạm</div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">Bên trong trạm RE</h1>
        <p className="mt-2 text-ink-2">
          Chạm vào số để xem từng bộ phận. Bản vẽ theo tỷ lệ 800 × 800 × 1.800 mm từ hồ sơ thiết kế; đây là ý tưởng, chưa có mẫu thử vật lý.
        </p>
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(260px,400px)_1fr] lg:gap-12">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Segmented
              label="Góc nhìn"
              hideLabel
              name="view"
              value={view}
              onChange={setView}
              options={[
                { value: 'exterior', label: 'Bên ngoài' },
                { value: 'cutaway', label: 'Mặt cắt A–A' },
              ]}
            />
          </div>
          <div className="mx-auto max-w-[300px] rounded-lg border border-line bg-panel p-3 md:max-w-none">
            <StationIllustration
              view={view}
              phase="READY"
              fillPct={fill}
              warnPct={80}
              stopPct={95}
              fault={null}
              rejected={false}
              pointsShown={null}
              screenText={op === 'stopped' ? 'Tạm ngừng nhận' : 'Quét mã QR'}
              selectedZone={zone}
              onSelectZone={pick}
              zoneNames={NAMES}
              title={`Trạm RE, ${view === 'exterior' ? 'nhìn từ ngoài' : 'mặt cắt A–A'}. Đang chọn: ${info.name}`}
            />
          </div>
          <div className="mt-4 rounded-lg border border-line bg-panel p-4">
            <label htmlFor="fill-try" className="flex items-center justify-between gap-2 text-sm font-medium text-ink">
              Thử mức đầy thùng
              <span className="tnum font-semibold">{fill} %</span>
            </label>
            <input id="fill-try" type="range" min={0} max={100} value={fill} onChange={(e) => setFill(Number(e.target.value))} className="mt-2 w-full accent-[rgb(var(--c-forest))]" />
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Badge tone={OP_META[op].tone} icon={OP_META[op].icon}>
                {OP_META[op].label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <ol className="flex flex-col gap-2" aria-label="Bộ phận của trạm">
            {ZONES.map((z, i) => {
              const zi = ZONE_INFO[z];
              const sel = z === zone;
              return (
                <li key={z}>
                  <button
                    type="button"
                    onClick={() => pick(z)}
                    aria-expanded={sel}
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded border px-3.5 text-left transition-colors ${sel ? 'border-ink bg-white shadow-1' : 'border-line bg-panel hover:border-line-strong'}`}
                  >
                    <span className={`tnum grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${sel ? 'bg-forest text-white' : 'border-2 border-forest text-forest'}`}>{i + 1}</span>
                    <Icon name={zi.icon} size={18} className="text-ink-2" />
                    <span className="flex-1 font-semibold text-ink">{zi.name}</span>
                    {CUTAWAY_ONLY.includes(z) && <span className="hidden text-xs text-muted sm:inline">chỉ thấy ở mặt cắt</span>}
                    <Icon name="chevronDown" size={16} className={`text-muted transition-transform ${sel ? 'rotate-180' : ''}`} />
                  </button>
                  {sel && (
                    <div className="rise border-x border-b border-ink/80 bg-white px-4 pb-4 pt-3" aria-live="polite">
                      <p className="text-ink-2">{zi.summary}</p>
                      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                        {zi.facts.map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-muted">{k}</dt>
                            <dd className="tnum font-medium text-ink">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-ink-2">
                        {zi.notes.map((n) => (
                          <li key={n} className="flex gap-2">
                            <Icon name="info" size={15} className="mt-0.5 text-info" />
                            {n}
                          </li>
                        ))}
                      </ul>
                      {zi.image && (
                        <figure className="mt-4">
                          <img src={zi.image.src} alt={zi.image.alt} loading="lazy" className="aspect-[16/10] w-full rounded border border-line object-cover" width={1200} height={750} />
                          <figcaption className="mt-1 text-xs text-muted">Ảnh dựng từ hồ sơ thiết kế</figcaption>
                        </figure>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <div className="mt-6 rounded-lg border border-dashed border-line-strong p-4">
            <div className="text-sm font-semibold text-ink">Trạm không làm những việc này</div>
            <ul className="mt-2 grid gap-1.5 text-sm text-ink-2 sm:grid-cols-3">
              <li className="flex gap-2">
                <Icon name="x" size={16} className="mt-0.5 text-fault-ink" /> Rửa chai. Rửa thuộc trạm xử lý phía sau.
              </li>
              <li className="flex gap-2">
                <Icon name="x" size={16} className="mt-0.5 text-fault-ink" /> Tách màu ra thùng riêng trong thí điểm.
              </li>
              <li className="flex gap-2">
                <Icon name="x" size={16} className="mt-0.5 text-fault-ink" /> Nhận HDPE. HDPE thuộc lộ trình sau.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
