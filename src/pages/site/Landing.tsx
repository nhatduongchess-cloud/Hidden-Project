import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import lobby from '../../assets/station-lobby.webp';
import sectionAA from '../../assets/section-aa.webp';
import binSwap from '../../assets/bin-swap.webp';
import cutaway from '../../assets/cutaway-34.webp';
import { Icon, type IconName } from '../../components/icons';
import { Badge, FillMeter } from '../../components/ui';
import { ZONES } from '../../components/StationIllustration';
import { useAppState } from '../../lib/store-context';
import { fillPct } from '../../domain/selectors';
import { userStats } from '../../domain/ops';
import { DEMO_DISTANCE_M } from '../../domain/constants';
import { availability, AVAIL, sortedStations } from '../app/screens';
import { ZONE_INFO } from './zones';
import { SITE_WRAP } from './SiteLayout';
import { areaById } from '../../domain/areas';
import { useOpenAreaPicker } from './AreaPicker';

const SPECS: [string, string][] = [
  ['Kích thước bao', '800 × 800 × 1.800 mm'],
  ['Vật liệu nhận', 'Chỉ chai PET rỗng'],
  ['Thùng chứa', '≈ 0,24 m³, một thùng'],
  ['Mức đầy', 'Cảnh báo 80 % · dừng 95 %'],
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'mapPin', title: 'Tìm trạm', body: 'Ứng dụng cho biết trạm nào đang nhận chai và trạm nào tạm ngừng.' },
  { icon: 'qr', title: 'Quét mã QR', body: 'Quét mã trên màn hình trạm để định danh. Không cần tạo tài khoản tại trạm.' },
  { icon: 'bottle', title: 'Đặt một chai', body: 'Một chai PET rỗng vào khe. Không cần rửa; chai còn nắp là mục tiêu đang thử nghiệm.' },
  { icon: 'camera', title: 'Trạm kiểm tra', body: 'Camera, mã vạch và cân cùng quyết định. Chai không hợp lệ được trả lại kèm lý do.' },
  { icon: 'checkCircle', title: 'Nhận điểm', body: 'Rulo cán dẹt chai. Điểm chỉ được cộng sau khi cảm biến xác nhận chai đã vào thùng.' },
];

const BENEFITS: { who: string; icon: IconName; points: string[] }[] = [
  {
    who: 'Người trả chai',
    icon: 'user',
    points: ['Trả chai trong khuôn viên, không cần rửa.', 'Thấy ngay chai được nhận hay bị trả lại, và vì sao.', 'Theo dõi điểm, số chai và lịch sử của mình.'],
  },
  {
    who: 'Chủ địa điểm',
    icon: 'building',
    points: ['Chai PET tách khỏi rác sinh hoạt ngay tại sảnh, ký túc xá.', 'Trạm tự dừng nhận ở 95 %, không tràn thùng.', 'Số liệu thu hồi theo từng trạm cho báo cáo hoạt động.'],
  },
  {
    who: 'Doanh nghiệp và nhãn hàng',
    icon: 'file',
    points: ['Bản ghi thu gom theo mã vạch của từng sản phẩm.', 'Khối lượng ước tính và khối lượng cân được tách bạch theo lô.', 'Tài liệu hỗ trợ báo cáo EPR, kèm danh sách chứng từ còn thiếu.'],
  },
];

const ROADMAP = [
  {
    id: 'proto',
    label: 'Mẫu thử',
    when: 'Q4/2026 – Q1/2027',
    scope: '1 trạm, mô hình nhận diện đầu tiên, RE Hub bản đầu.',
    gate: 'Rulo xử lý được chai còn nắp; nhận diện ≥ 95 % trên tập kiểm tra; khóa liên động không lỗi.',
    projected: false,
  },
  {
    id: 'pilot',
    label: 'Thí điểm 3 trạm',
    when: '3 tháng, 2027',
    scope: '3 trạm tại 1 trường đại học, chỉ chai PET. Nửa đầu thu theo lịch cố định, nửa sau theo tuyến của RE Hub.',
    gate: 'Biết chi phí/kg và km/tấn thực tế; có 1 bên thu mua và 1 đối tác trả phí bằng văn bản.',
    projected: false,
  },
  {
    id: 'net30',
    label: 'Mạng lưới 30 trạm',
    when: '2028 · dự phóng',
    scope: 'Khoảng 30 trạm tại 5–10 trường trong một thành phố.',
    gate: 'Mục tiêu hòa vốn cấp mạng lưới. Đây là dự phóng của đề xuất, chưa có dữ liệu vận hành.',
    projected: true,
  },
  {
    id: 'net100',
    label: '100 trạm + trạm xử lý',
    when: '2029 · dự phóng',
    scope: 'Khoảng 100 trạm và một trạm xử lý mô-đun ra mảnh PET sạch. Bổ sung chai HDPE ở giai đoạn này.',
    gate: 'Trạm xử lý gần đạt công suất; hợp đồng nhãn hàng dài hạn. Toàn bộ là dự phóng.',
    projected: true,
  },
];

function SystemDiagram() {
  const nodes = [
    { x: 0, label: 'Người trả chai', sub: 'ứng dụng RE' },
    { x: 205, label: 'Trạm RE', sub: 'kiểm tra · cán dẹt' },
    { x: 410, label: 'Tài xế thu gom', sub: 'đổi thùng đầy' },
    { x: 615, label: 'Điểm tiếp nhận', sub: 'cân theo lô' },
    { x: 820, label: 'Đối tác tái chế', sub: 'giai đoạn thí điểm' },
  ];
  const label = (x: number, y: number, t: string, anchor: 'start' | 'middle' | 'end' = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} fontSize={12.5} fill="rgb(var(--c-forest-ink))" fontWeight={500} paintOrder="stroke" stroke="rgb(var(--c-paper))" strokeWidth={5}>
      {t}
    </text>
  );
  return (
    <svg viewBox="-4 -4 1012 330" className="h-auto w-full" role="img" aria-labelledby="sysdiag-t sysdiag-d">
      <title id="sysdiag-t">Dòng vật liệu và dòng dữ liệu của RE</title>
      <desc id="sysdiag-d">
        Chai đi từ người trả chai qua trạm RE, tài xế, điểm tiếp nhận đến đối tác tái chế. Dữ liệu từ trạm, tài xế, phiếu cân và tài liệu bên tái chế đi về RE Hub; RE Hub gửi tuyến cho tài xế và
        hồ sơ lô cho nhãn hàng.
      </desc>
      <defs>
        <marker id="ah-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="rgb(var(--c-ink))" />
        </marker>
        <marker id="ah-forest" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="rgb(var(--c-forest))" />
        </marker>
      </defs>
      {nodes.map((n, i) => (
        <g key={n.label}>
          <rect x={n.x} y={20} width={180} height={66} rx={6} fill="rgb(var(--c-panel))" stroke="rgb(var(--c-ink) / 0.55)" strokeWidth={1.25} />
          <text x={n.x + 14} y={47} fontSize={14.5} fontWeight={600} fill="rgb(var(--c-ink))">
            {n.label}
          </text>
          <text x={n.x + 14} y={68} fontSize={12} fill="rgb(var(--c-muted))">
            {n.sub}
          </text>
          {i < nodes.length - 1 && <line x1={n.x + 182} y1={53} x2={n.x + 202} y2={53} stroke="rgb(var(--c-ink))" strokeWidth={2} markerEnd="url(#ah-ink)" />}
        </g>
      ))}
      {/* RE Hub */}
      <rect x={330} y={232} width={340} height={64} rx={6} fill="rgb(var(--c-forest))" />
      <text x={500} y={259} textAnchor="middle" fontSize={15} fontWeight={700} fill="#fff">
        RE Hub
      </text>
      <text x={500} y={280} textAnchor="middle" fontSize={12} fill="rgb(255 255 255 / 0.8)">
        mức đầy · tuyến · hồ sơ lô
      </text>
      {/* brands */}
      <rect x={0} y={232} width={190} height={64} rx={6} fill="rgb(var(--c-panel))" stroke="rgb(var(--c-forest))" strokeWidth={1.25} strokeDasharray="5 4" />
      <text x={14} y={259} fontSize={14.5} fontWeight={600} fill="rgb(var(--c-ink))">
        Nhãn hàng
      </text>
      <text x={14} y={280} fontSize={12} fill="rgb(var(--c-muted))">
        tài liệu hỗ trợ EPR
      </text>
      <g fill="none" stroke="rgb(var(--c-forest))" strokeWidth={1.6} strokeDasharray="5 4">
        <path d="M295 88 V160 H360 V230" markerEnd="url(#ah-forest)" />
        <path d="M470 230 V90" markerEnd="url(#ah-forest)" />
        <path d="M530 88 V230" markerEnd="url(#ah-forest)" />
        <path d="M705 88 V160 H630 V230" markerEnd="url(#ah-forest)" />
        <path d="M910 88 V264 H672" markerEnd="url(#ah-forest)" />
        <path d="M328 264 H192" markerEnd="url(#ah-forest)" />
      </g>
      {label(300, 180, 'từng chai, mức đầy', 'start')}
      {label(462, 150, 'tuyến', 'end')}
      {label(538, 150, 'xác nhận thay thùng', 'start')}
      {label(712, 180, 'phiếu cân', 'start')}
      {label(905, 212, 'chứng từ phía sau', 'end')}
      {label(260, 256, 'hồ sơ lô')}
    </svg>
  );
}

const MOBILE_FLOW: { k: string; v: string; data: string }[] = [
  { k: 'Người trả chai', v: 'Quét QR, đặt từng chai PET rỗng.', data: 'Nhận điểm sau khi chai vào thùng' },
  { k: 'Trạm RE', v: 'Kiểm tra, cán dẹt, lưu trong thùng 0,24 m³.', data: 'Gửi giao dịch từng chai và mức đầy lên RE Hub' },
  { k: 'Tài xế thu gom', v: 'Chỉ đến khi trạm sắp đầy, đổi thùng đầy lấy thùng rỗng.', data: 'Nhận tuyến từ RE Hub, gửi xác nhận thay thùng' },
  { k: 'Điểm tiếp nhận', v: 'Gom thùng thành lô và cân.', data: 'Phiếu cân đối chiếu với khối lượng ước tính' },
  { k: 'Đối tác tái chế', v: 'Nhận lô PET đã cán dẹt.', data: 'Tài liệu phía sau được đính kèm vào lô' },
];

const SLIDES = [
  { src: lobby, alt: 'Ảnh dựng 3D: một người đặt chai vào trạm RE ở sảnh trường đại học', caption: 'Trạm RE tại sảnh trường đại học' },
  { src: cutaway, alt: 'Ảnh dựng 3D cắt mở 3/4: cụm rulo kép phía trên thùng chứa', caption: 'Cắt mở 3/4: rulo kép phía trên thùng chứa' },
  { src: binSwap, alt: 'Ảnh dựng 3D: nhân viên kéo thùng chứa ra khỏi trạm để thay thùng', caption: 'Thay thùng đầy lấy thùng rỗng tại trạm' },
];

const GALLERY = [
  { src: lobby, alt: 'Ảnh dựng: trạm RE ở sảnh trường', label: 'Sảnh trường' },
  { src: sectionAA, alt: 'Mặt cắt A–A của trạm RE: khoang nhận, rulo kép, thùng chứa và cảm biến', label: 'Mặt cắt A–A' },
  { src: cutaway, alt: 'Ảnh dựng cắt mở 3/4 của trạm RE', label: 'Cắt mở 3/4' },
  { src: binSwap, alt: 'Ảnh dựng: kéo thùng chứa ra khỏi trạm', label: 'Thay thùng' },
];

const QUICK_RETURN: { icon: IconName; label: string }[] = [
  { icon: 'mapPin', label: 'Tìm trạm đang nhận' },
  { icon: 'qr', label: 'Quét mã QR' },
  { icon: 'bottle', label: 'Đặt một chai' },
  { icon: 'checkCircle', label: 'Nhận điểm khi chai vào thùng' },
];

const FOR_BRANDS: { icon: IconName; label: string }[] = [
  { icon: 'barcode', label: 'Bản ghi theo mã vạch' },
  { icon: 'scale', label: 'Phiếu cân theo lô' },
  { icon: 'file', label: 'Tài liệu hỗ trợ EPR' },
  { icon: 'fileMissing', label: 'Chứng từ còn thiếu' },
];

const FOR_DRIVERS: { icon: IconName; label: string }[] = [
  { icon: 'alert', label: 'Trạm ≥ 80 % lên danh sách' },
  { icon: 'clock', label: 'Xếp theo thời gian lái thật' },
  { icon: 'route', label: 'Dẫn đường từng chỗ rẽ' },
  { icon: 'bin', label: 'Xác nhận thay thùng' },
];

/** A white card in the home grid: a title, its content, and a link at the bottom. */
function HomeCard({ title, children, href, more, region }: { title: string; children: ReactNode; href: string; more: string; region?: boolean }) {
  const id = useId();
  return (
    <section aria-labelledby={region ? id : undefined} aria-label={region ? undefined : title} className="shop-card flex min-w-0 flex-col p-5">
      <h2 id={id} className="text-[21px] font-bold leading-tight text-shop-text">
        {title}
      </h2>
      <div className="mt-3 min-h-0 flex-1">{children}</div>
      <a href={href} className="shop-link mt-4 text-[13px] font-medium">
        {more}
      </a>
    </section>
  );
}

function IconQuad({ items }: { items: { icon: IconName; label: string }[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((it) => (
        <li key={it.label} className="flex min-w-0 flex-col gap-1.5">
          <span className="grid aspect-[4/3] place-items-center rounded-sm bg-shop-tile">
            <Icon name={it.icon} size={34} strokeWidth={1.5} className="text-forest" />
          </span>
          <span className="text-xs leading-snug text-shop-text">{it.label}</span>
        </li>
      ))}
    </ul>
  );
}

function NearbyStations() {
  const state = useAppState();
  const openArea = useOpenAreaPicker();
  return (
    <>
      <p className="mb-2 flex items-center gap-1.5 text-sm text-shop-muted">
        <Icon name="mapPin" size={15} className="shrink-0" />
        <span className="min-w-0 truncate">{areaById(state.settings.areaId).city} · minh họa</span>
        <button type="button" onClick={openArea} className="shop-link shrink-0 text-[13px]" aria-haspopup="dialog">
          Đổi khu vực
        </button>
      </p>
      <ul className="flex flex-col divide-y divide-shop-line">
        {sortedStations(state).map((st) => {
          const a = availability(state, st);
          const pct = fillPct(state, st, 'hub');
          return (
            <li key={st.id} className="flex flex-col gap-1.5 py-2.5 first:pt-0">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm">
                  <span className="id-tag font-semibold">{st.id}</span> · {st.name}
                </span>
                <span className="tnum shrink-0 text-xs text-shop-muted">{DEMO_DISTANCE_M[st.id] ?? '–'} m</span>
              </div>
              <Badge tone={AVAIL[a].tone} icon={AVAIL[a].icon} className="self-start">
                {AVAIL[a].label}
              </Badge>
              <FillMeter pct={pct} stale={a === 'unknown'} size="sm" label={`Mức đầy ${st.id}`} />
            </li>
          );
        })}
      </ul>
    </>
  );
}

function YourReturns() {
  const state = useAppState();
  const s = useMemo(() => userStats(state, state.currentUserId, 0), [state]);
  const user = state.users.find((u) => u.id === state.currentUserId);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-shop-muted">{user?.label ?? 'Bạn'} · tài khoản demo trong trình duyệt này</p>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Điểm', s.creditedPoints],
          ['Chai đã nhận', s.acceptedBottles],
          ['Bị trả lại', s.returnedItems],
        ].map(([k, v]) => (
          <div key={k} className="rounded-sm bg-shop-tile px-1 py-3">
            <dd className="tnum text-2xl font-bold text-shop-text">{v}</dd>
            <dt className="text-xs text-shop-muted">{k}</dt>
          </div>
        ))}
      </dl>
      {s.pendingPoints > 0 && <p className="text-xs text-shop-muted">{s.pendingPoints} điểm đang chờ trạm đồng bộ.</p>}
      <p className="text-xs text-shop-muted">Điểm chưa có giá trị quy đổi: chưa có nhà tài trợ hay ưu đãi nào.</p>
    </div>
  );
}

function HeroCarousel() {
  const [i, setI] = useState(0);
  const n = SLIDES.length;
  const s = SLIDES[i];
  return (
    <section aria-roledescription="carousel" aria-label="Ảnh trạm RE" className="relative aspect-[16/10] w-full md:absolute md:inset-y-0 md:right-0 md:aspect-auto md:w-[68%]">
      <img key={s.src} src={s.src} alt={s.alt} className="rise h-full w-full object-cover" width={1200} height={750} />
      {/* One control cluster on the image, above the hero text layer */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full bg-black/70 p-1 text-white md:bottom-auto md:right-5 md:top-5">
        <button type="button" onClick={() => setI((i - 1 + n) % n)} aria-label="Ảnh trước" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <Icon name="chevronLeft" size={22} strokeWidth={2} />
        </button>
        <p aria-live="polite" className="flex items-center gap-2 px-1 text-xs">
          <span className="tnum font-semibold">
            {i + 1} / {n}
          </span>
          <span className="hidden max-w-[18rem] truncate sm:inline">Ảnh dựng 3D · {s.caption}</span>
        </p>
        <button type="button" onClick={() => setI((i + 1) % n)} aria-label="Ảnh sau" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
          <Icon name="chevronRight" size={22} strokeWidth={2} />
        </button>
      </div>
      <div className="absolute left-3 top-3 rounded-sm bg-black/70 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-white md:hidden">Ảnh dựng 3D</div>
    </section>
  );
}

function PartsRow() {
  const row = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => row.current?.scrollBy({ left: dir * row.current.clientWidth * 0.8, behavior: 'smooth' });
  return (
    <section aria-labelledby="parts-title" className="shop-card p-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="parts-title" className="text-[21px] font-bold text-shop-text">
          Khám phá trạm theo bộ phận
        </h2>
        <a href="#explorer" className="shop-link text-[13px] font-medium">
          Xem trạm tương tác
        </a>
      </div>
      <div className="relative mt-4">
        <ul ref={row} className="scroll-thin flex snap-x gap-4 overflow-x-auto pb-2">
          {ZONES.map((z, idx) => {
            const zi = ZONE_INFO[z];
            return (
              <li key={z} className="w-[230px] shrink-0 snap-start sm:w-[260px]">
                <a href={`#explorer-${z}`} className="group flex h-full flex-col gap-2">
                  {zi.image && <img src={zi.image.src} alt="" loading="lazy" className="aspect-[16/10] w-full rounded-sm bg-shop-tile object-cover" width={1200} height={750} />}
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-shop-link group-hover:text-shop-link-hover group-hover:underline">
                    <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-forest text-xs font-bold text-forest">{idx + 1}</span>
                    {zi.name}
                  </span>
                  <span className="line-clamp-3 text-[13px] text-shop-muted">{zi.summary}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => scroll(-1)} aria-label="Cuộn sang trái" className="absolute -left-2 top-[60px] hidden h-20 w-11 place-items-center rounded-r-sm border border-shop-line bg-white/95 shadow-2 hover:bg-white md:grid">
          <Icon name="chevronLeft" size={26} />
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label="Cuộn sang phải" className="absolute -right-2 top-[60px] hidden h-20 w-11 place-items-center rounded-l-sm border border-shop-line bg-white/95 shadow-2 hover:bg-white md:grid">
          <Icon name="chevronRight" size={26} />
        </button>
      </div>
    </section>
  );
}

function StationDetail() {
  const [img, setImg] = useState(0);
  const g = GALLERY[img];
  return (
    <section aria-labelledby="station-title" className="shop-card grid gap-6 p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_280px] lg:gap-8">
      {/* Gallery: thumbnails beside the image, like a product page */}
      <div className="flex min-w-0 flex-col-reverse gap-3 sm:flex-row">
        <div role="group" aria-label="Chọn ảnh" className="flex gap-2 sm:flex-col">
          {GALLERY.map((x, k) => (
            <button
              key={x.label}
              type="button"
              onClick={() => setImg(k)}
              onMouseEnter={() => setImg(k)}
              aria-pressed={k === img}
              aria-label={x.label}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 bg-shop-tile ${k === img ? 'border-shop-link shadow-[0_0_3px_2px_rgb(var(--c-shop-link)/0.35)]' : 'border-shop-line hover:border-[#A2A6AC]'}`}
            >
              <img src={x.src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
        <figure className="min-w-0 flex-1">
          <img src={g.src} alt={g.alt} className="aspect-[16/10] w-full rounded-sm object-cover" loading="lazy" width={1200} height={750} />
          <figcaption className="mt-1.5 text-xs text-shop-muted">Ảnh dựng từ hồ sơ thiết kế · {g.label}</figcaption>
        </figure>
      </div>

      <div className="min-w-0">
        <a href="#explorer" className="shop-link text-sm">
          Thiết kế của nhóm dự thi PCIC 2026
        </a>
        <h2 id="station-title" className="mt-1 text-2xl font-medium leading-snug text-shop-text">
          Trạm thu hồi chai PET RE, 800 × 800 × 1.800 mm, một thùng 0,24 m³
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="slate" icon="sparkle">
            Mô hình đề xuất
          </Badge>
          <span className="text-shop-muted">Chưa có mẫu thử vật lý, chưa có đánh giá của người dùng</span>
        </div>
        <hr className="my-4 border-shop-line" />
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
          {SPECS.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-bold text-shop-text">{k}</dt>
              <dd className="tnum text-shop-text">{v}</dd>
            </div>
          ))}
        </dl>
        <hr className="my-4 border-shop-line" />
        <h3 className="font-bold text-shop-text">Về trạm này</h3>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-sm text-shop-text">
          {[
            'Một khoang kín, hai cửa, hai rulo, một thùng. Cửa ngoài và sàn rơi không bao giờ mở cùng lúc; rulo chỉ quay khi cửa ngoài đã đóng.',
            'Nhận diện kết hợp camera, mã vạch và cân. Camera một mình không xác định chắc chắn loại nhựa.',
            'Không dùng nước trong trạm. Khay đáy chỉ hứng phần nước còn sót.',
            'Thí điểm dùng một thùng: AI ghi loại chai vào dữ liệu, không tách màu ra thùng riêng.',
          ].map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>

      {/* The "buy box": what is planned, and where to try it */}
      <aside aria-label="Thí điểm đề xuất" className="flex h-fit flex-col gap-3 rounded-lg border border-shop-line p-4">
        <div className="text-xs text-shop-muted">Thí điểm đề xuất</div>
        <div className="text-[22px] font-medium leading-tight text-shop-text">3 trạm · 1 trường · 3 tháng</div>
        <div className="text-lg font-medium text-forest">Kế hoạch đề xuất</div>
        <p className="text-sm text-shop-text">Chỉ nhận chai PET rỗng. Nửa đầu thu gom theo lịch cố định, nửa sau theo tuyến của RE Hub.</p>
        <a href="#app-return" className="btn btn-shop w-full">
          Thử trả một chai
        </a>
        <a href="#pilot" className="btn btn-shop-alt w-full">
          Xem kinh tế thí điểm
        </a>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-shop-muted">Trạng thái</dt>
          <dd>Ý tưởng dự thi</dd>
          <dt className="text-shop-muted">Vận hành</dt>
          <dd>Chưa có</dd>
          <dt className="text-shop-muted">Đối tác</dt>
          <dd>Chưa ký</dd>
        </dl>
        <p className="text-xs text-shop-muted">Trạm không được bán. Trang này là bản mẫu dự thi.</p>
      </aside>
    </section>
  );
}

export function Landing() {
  const [stage, setStage] = useState('pilot');
  const st = ROADMAP.find((r) => r.id === stage)!;
  return (
    <>
      {/* Hero: text on the dark band, renders on the right, fading into the page */}
      <div className="relative overflow-hidden bg-shop-nav-2 text-white md:min-h-[460px] lg:min-h-[560px]">
        <HeroCarousel />
        <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[62%] bg-gradient-to-r from-shop-nav-2 from-45% to-transparent md:block" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-48 bg-gradient-to-b from-transparent to-shop-ground lg:block" aria-hidden />
        <div className={`${SITE_WRAP} relative pb-10 pt-6 md:pb-12 md:pt-10 lg:pb-52`}>
          <div className="max-w-[560px] md:max-w-[44%]">
            <Badge tone="neutral" className="mb-4 border border-white/30 bg-white/10 font-mono text-[11px] uppercase tracking-wider text-white">
              Mô hình đề xuất · PCIC 2026
            </Badge>
            <h1 className="text-[30px] font-bold leading-[1.15] sm:text-4xl lg:text-[44px] lg:leading-[1.12]">
              Trả chai PET. Nhận điểm. <span className="text-shop-cta">Theo dõi hành trình tái chế.</span>
            </h1>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-white/85">
              RE là trạm thu hồi chai PET cho khuôn viên trường và tòa nhà, kèm RE Hub để điều phối thu gom và lập hồ sơ từng lô vật liệu cho nhãn hàng.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#app-return" className="btn btn-lg btn-shop">
                <Icon name="bottle" size={20} />
                Trải nghiệm trả chai
              </a>
              <a href="#hub" className="btn btn-lg btn-shop-plain">
                Khám phá RE Hub
                <Icon name="arrowRight" size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className={`${SITE_WRAP} relative z-10 flex flex-col gap-5 pt-5 lg:-mt-48 lg:pt-0`}>
        {/* Card grid over the hero */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <HomeCard title="Trả chai, nhận điểm" href="#app-return" more="Thử trả một chai">
            <IconQuad items={QUICK_RETURN} />
          </HomeCard>
          <HomeCard title="Trạm gần bạn" href="#app-stations" more="Tìm trạm trên ứng dụng" region>
            <NearbyStations />
          </HomeCard>
          <HomeCard title="Bên trong trạm RE" href="#explorer" more="Khám phá từng bộ phận">
            <img src={cutaway} alt="Ảnh dựng cắt mở 3/4 của trạm RE: rulo kép phía trên thùng chứa" className="aspect-square w-full rounded-sm object-cover" loading="lazy" width={1200} height={750} />
          </HomeCard>
          <HomeCard title="Dành cho nhãn hàng" href="#hub-trace" more="Xem truy xuất trong RE Hub">
            <IconQuad items={FOR_BRANDS} />
          </HomeCard>
          <HomeCard title="Xe thu gom đến đúng lúc" href="#driver-map" more="Mở bản đồ tài xế">
            <IconQuad items={FOR_DRIVERS} />
          </HomeCard>
          <HomeCard title="Điểm của bạn" href="#app-rewards" more="Xem điểm thưởng">
            <YourReturns />
          </HomeCard>
          <HomeCard title="Thí điểm sẽ đo" href="#pilot" more="Thử các giả định kinh tế">
            <ul className="flex flex-col gap-2.5 text-sm text-shop-text">
              {['Số kg giao cho bên tái chế, theo phiếu cân của bên mua', 'Tỷ lệ chai bị từ chối và lý do', 'Số kg mỗi chuyến và số km trên mỗi tấn', 'Tỷ lệ PET trong và PET màu', 'Chi phí trên mỗi kg'].map((m) => (
                <li key={m} className="flex gap-2">
                  <Icon name="scale" size={16} className="mt-0.5 shrink-0 text-forest" />
                  {m}
                </li>
              ))}
            </ul>
          </HomeCard>
          <HomeCard title="Mặt cắt kỹ thuật" href="#explorer-inspection" more="Xem khoang nhận diện">
            <img src={sectionAA} alt="Mặt cắt A–A của trạm RE: khoang nhận, rulo kép, thùng chứa và cảm biến" className="aspect-square w-full rounded-sm object-cover" loading="lazy" width={1200} height={750} />
          </HomeCard>
        </div>

        <PartsRow />
        <StationDetail />

        {/* How returning works */}
        <section aria-labelledby="steps-title" className="shop-card p-5 md:p-6">
          <h2 id="steps-title" className="text-[21px] font-bold text-shop-text">
            Cách trả chai: năm bước, một chai mỗi lần
          </h2>
          <ol className="mt-4 grid gap-px overflow-hidden rounded-sm border border-shop-line bg-shop-line sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col gap-2 bg-white p-5">
                <div className="flex items-center gap-3">
                  <span className="tnum grid h-7 w-7 place-items-center rounded-full bg-shop-nav-2 text-xs font-bold text-white">{i + 1}</span>
                  <Icon name={s.icon} size={20} className="text-forest" />
                </div>
                <h3 className="mt-1 font-semibold text-shop-text">{s.title}</h3>
                <p className="text-sm text-shop-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-start gap-2 text-sm text-shop-muted">
            <Icon name="info" size={16} className="mt-0.5 shrink-0 text-info" />
            Chai bị trả lại không được cộng điểm. Khi trạm đạt 95 % mức đầy, trạm tự dừng nhận và ứng dụng chỉ đường đến trạm khác.
          </p>
        </section>

        {/* System connection */}
        <section aria-labelledby="system-title" className="shop-card p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_2fr] md:items-end">
            <h2 id="system-title" className="text-[21px] font-bold text-shop-text">
              Vật liệu đi một chiều, dữ liệu đi cùng
            </h2>
            <p className="max-w-[60ch] text-sm text-shop-muted">
              Trạm, đội thu gom và đối tác tái chế cùng ghi vào một nguồn dữ liệu. RE Hub dùng nó để biết khi nào cần xe, và để đối chiếu khối lượng ước tính tại trạm với phiếu cân
              của từng lô.
            </p>
          </div>
          <div className="mt-6 hidden md:block">
            <SystemDiagram />
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-shop-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-6 bg-ink" /> Dòng vật liệu
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0 w-6 border-t-2 border-dashed border-forest" /> Dòng dữ liệu
              </span>
              <span>Trạm không rửa chai. Rửa và băm thuộc trạm xử lý ở giai đoạn sau.</span>
            </div>
          </div>
          <ol className="mt-6 flex flex-col md:hidden">
            {MOBILE_FLOW.map((f, i) => (
              <li key={f.k} className="relative flex gap-4 pb-6 last:pb-0">
                {i < MOBILE_FLOW.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-28px)] w-0.5 bg-ink/70" aria-hidden />}
                <span className="tnum z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-xs font-bold">{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-shop-text">{f.k}</div>
                  <div className="text-sm text-shop-muted">{f.v}</div>
                  <div className="mt-1 flex items-start gap-1.5 text-sm text-forest-ink">
                    <Icon name="sync" size={15} className="mt-0.5 shrink-0" />
                    {f.data}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Benefits */}
        <section aria-labelledby="benefits-title" className="flex flex-col gap-3">
          <h2 id="benefits-title" className="text-[21px] font-bold text-shop-text">
            Lợi ích dự kiến cho từng bên
          </h2>
          <div className="grid gap-5 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.who} className="shop-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-2.5">
                  <Icon name={b.icon} size={20} className="text-forest" />
                  <h3 className="font-bold text-shop-text">{b.who}</h3>
                </div>
                <ul className="flex flex-col gap-2 text-sm text-shop-text">
                  {b.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <Icon name="check" size={16} className="mt-0.5 shrink-0 text-forest" strokeWidth={2.2} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-sm text-shop-muted">Đây là giá trị đề xuất. Thí điểm 3 trạm được thiết kế để kiểm chứng chúng.</p>
        </section>

        {/* Roadmap */}
        <section aria-labelledby="roadmap-title" className="shop-card p-5 md:p-6">
          <h2 id="roadmap-title" className="text-[21px] font-bold text-shop-text">
            Lộ trình
          </h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            <div className="min-w-0">
              <div role="tablist" aria-label="Giai đoạn lộ trình" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ROADMAP.map((r, i) => (
                  <button
                    key={r.id}
                    role="tab"
                    type="button"
                    id={`rm-${r.id}`}
                    aria-selected={stage === r.id}
                    aria-controls="rm-panel"
                    onClick={() => setStage(r.id)}
                    className={`flex min-h-[64px] flex-col items-start justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                      stage === r.id ? 'border-shop-nav-2 bg-shop-nav-2 text-white' : r.projected ? 'border-dashed border-[#A2A6AC] bg-white text-shop-text hover:bg-[#F7FAFA]' : 'border-shop-line bg-white text-shop-text hover:bg-[#F7FAFA]'
                    }`}
                  >
                    <span className={`tnum font-mono text-[11px] ${stage === r.id ? 'text-white/70' : 'text-shop-muted'}`}>0{i + 1}</span>
                    <span className="text-sm font-semibold leading-tight">{r.label}</span>
                  </button>
                ))}
              </div>
              <div id="rm-panel" role="tabpanel" aria-labelledby={`rm-${st.id}`} className="mt-3 rounded-md border border-shop-line p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-shop-text">{st.label}</h3>
                  <span className="text-sm text-shop-muted">{st.when}</span>
                  {st.projected ? <Badge tone="slate" icon="sparkle">Dự phóng</Badge> : <Badge tone="forest">Kế hoạch đề xuất</Badge>}
                </div>
                <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-shop-muted">Phạm vi</dt>
                    <dd className="mt-1 text-shop-text">{st.scope}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-shop-muted">Điều kiện chuyển giai đoạn</dt>
                    <dd className="mt-1 text-shop-text">{st.gate}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div className="rounded-md border border-shop-line p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-shop-text">
                  <Icon name="checkCircle" size={17} className="text-forest" /> Đã có
                </div>
                <p className="mt-1 text-sm text-shop-text">Thiết kế 3D trạm (6 góc nhìn, mặt cắt kỹ thuật), thiết kế ý tưởng trạm xử lý, bản mẫu RE Hub này.</p>
              </div>
              <div className="rounded-md border border-dashed border-[#A2A6AC] p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-shop-text">
                  <Icon name="clock" size={17} className="text-slate" /> Chưa có
                </div>
                <p className="mt-1 text-sm text-shop-text">Mẫu thử vật lý, mạng lưới vận hành, đối tác đã ký, số liệu thí điểm.</p>
              </div>
              <a href="#pilot" className="shop-link inline-flex items-center gap-1 text-sm font-medium">
                Xem kịch bản kinh tế thí điểm
                <Icon name="arrowRight" size={16} />
              </a>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
