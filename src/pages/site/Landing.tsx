import { useState } from 'react';
import lobby from '../../assets/station-lobby.webp';
import sectionAA from '../../assets/section-aa.webp';
import binSwap from '../../assets/bin-swap.webp';
import { Icon, type IconName } from '../../components/icons';
import { Badge } from '../../components/ui';

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

export function Landing() {
  const [stage, setStage] = useState('pilot');
  const st = ROADMAP.find((r) => r.id === stage)!;
  return (
    <>
      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-content items-center gap-8 px-4 pb-10 pt-8 sm:px-6 md:grid-cols-[1.05fr_1fr] md:gap-10 md:pb-14 md:pt-12">
          <div className="min-w-0">
            <Badge tone="neutral" className="mb-4 border border-line-strong bg-panel font-mono text-[11px] uppercase tracking-wider">
              Mô hình đề xuất · PCIC 2026
            </Badge>
            <h1 className="text-[30px] font-bold leading-[1.15] text-ink sm:text-4xl lg:text-[44px] lg:leading-[1.12]">
              Trả chai PET. Nhận điểm. <span className="text-forest">Theo dõi hành trình tái chế.</span>
            </h1>
            <p className="mt-4 max-w-[54ch] text-[16px] leading-relaxed text-ink-2">
              RE là trạm thu hồi chai PET cho khuôn viên trường và tòa nhà, kèm RE Hub để điều phối thu gom và lập hồ sơ từng lô vật liệu cho nhãn hàng.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#app-return" className="btn btn-primary btn-lg">
                <Icon name="bottle" size={20} />
                Trải nghiệm trả chai
              </a>
              <a href="#hub" className="btn btn-secondary btn-lg">
                Khám phá RE Hub
                <Icon name="arrowRight" size={18} />
              </a>
            </div>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
              {SPECS.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="tnum font-semibold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <figure className="min-w-0">
            <div className="relative overflow-hidden rounded-lg border border-line bg-[#dcdedb]">
              <img src={lobby} alt="Ảnh dựng 3D: một người đặt chai vào trạm RE ở sảnh trường đại học" className="aspect-[16/10] w-full object-cover" width={1200} height={750} />
              <span className="absolute left-3 top-3 rounded-sm bg-ink/80 px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-paper">Ảnh dựng 3D</span>
            </div>
            <figcaption className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              <span>Trạm RE tại sảnh trường đại học. Chưa có mẫu thử vật lý.</span>
              <a href="#explorer" className="link shrink-0">
                Xem mặt cắt
              </a>
            </figcaption>
          </figure>
        </div>
      </section>

      {/* How returning works */}
      <section className="mx-auto max-w-content px-4 py-12 sm:px-6 md:py-16">
        <div className="eyebrow mb-2">Cách trả chai</div>
        <h2 className="max-w-[30ch] text-2xl font-semibold text-ink md:text-3xl">Năm bước, một chai mỗi lần</h2>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-2 bg-panel p-5">
              <div className="flex items-center gap-3">
                <span className="tnum grid h-7 w-7 place-items-center rounded-full bg-ink text-xs font-bold text-paper">{i + 1}</span>
                <Icon name={s.icon} size={20} className="text-forest" />
              </div>
              <h3 className="mt-1 font-semibold text-ink">{s.title}</h3>
              <p className="text-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <Icon name="info" size={16} className="mt-0.5 text-info" />
          Chai bị trả lại không được cộng điểm. Khi trạm đạt 95 % mức đầy, trạm tự dừng nhận và ứng dụng chỉ đường đến trạm khác.
        </p>
      </section>

      {/* System connection */}
      <section className="border-y border-line bg-panel">
        <div className="mx-auto max-w-content px-4 py-12 sm:px-6 md:py-16">
          <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:items-end">
            <div>
              <div className="eyebrow mb-2">Hệ thống</div>
              <h2 className="text-2xl font-semibold text-ink md:text-3xl">Vật liệu đi một chiều, dữ liệu đi cùng</h2>
            </div>
            <p className="max-w-[60ch] text-ink-2">
              Trạm, đội thu gom và đối tác tái chế cùng ghi vào một nguồn dữ liệu. RE Hub dùng nó để biết khi nào cần xe, và để đối chiếu khối lượng ước tính tại trạm với phiếu cân
              của từng lô.
            </p>
          </div>
          <div className="mt-8 hidden md:block">
            <SystemDiagram />
            <div className="mt-3 flex flex-wrap gap-5 text-xs text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-6 bg-ink" /> Dòng vật liệu
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0 w-6 border-t-2 border-dashed border-forest" /> Dòng dữ liệu
              </span>
              <span>Trạm không rửa chai. Rửa và băm thuộc trạm xử lý ở giai đoạn sau.</span>
            </div>
          </div>
          <ol className="mt-8 flex flex-col md:hidden">
            {MOBILE_FLOW.map((f, i) => (
              <li key={f.k} className="relative flex gap-4 pb-6 last:pb-0">
                {i < MOBILE_FLOW.length - 1 && <span className="absolute left-[13px] top-8 h-[calc(100%-28px)] w-0.5 bg-ink/70" aria-hidden />}
                <span className="tnum z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper text-xs font-bold">{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{f.k}</div>
                  <div className="text-sm text-ink-2">{f.v}</div>
                  <div className="mt-1 flex items-start gap-1.5 text-sm text-forest-ink">
                    <Icon name="sync" size={15} className="mt-0.5" />
                    {f.data}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Station */}
      <section className="mx-auto max-w-content px-4 py-12 sm:px-6 md:py-16">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <figure className="order-2 min-w-0 md:order-1">
            <img src={sectionAA} alt="Mặt cắt đứng A–A của trạm RE: khoang nhận, rulo kép, thùng chứa và cảm biến" className="aspect-[16/10] w-full rounded-lg border border-line object-cover" loading="lazy" width={1200} height={750} />
            <figcaption className="mt-2 text-xs text-muted">Mặt cắt A–A từ hồ sơ thiết kế (ảnh dựng)</figcaption>
          </figure>
          <div className="order-1 min-w-0 md:order-2">
            <div className="eyebrow mb-2">Trạm RE</div>
            <h2 className="text-2xl font-semibold text-ink md:text-3xl">Một khoang kín, hai cửa, hai rulo, một thùng</h2>
            <ul className="mt-5 flex flex-col gap-3 text-ink-2">
              {[
                'Cửa ngoài và sàn rơi không bao giờ mở cùng lúc; rulo chỉ quay khi cửa ngoài đã đóng.',
                'Nhận diện kết hợp camera, mã vạch và cân. Camera một mình không xác định chắc chắn loại nhựa.',
                'Không dùng nước trong trạm. Khay đáy chỉ hứng phần nước còn sót.',
                'Thí điểm dùng một thùng: AI ghi loại chai vào dữ liệu, không tách màu ra thùng riêng.',
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <Icon name="check" size={18} className="mt-0.5 text-forest" strokeWidth={2.2} />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <a href="#explorer" className="btn btn-secondary mt-6">
              Khám phá trạm tương tác
              <Icon name="arrowRight" size={17} />
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-line bg-panel">
        <div className="mx-auto max-w-content px-4 py-12 sm:px-6 md:py-16">
          <div className="eyebrow mb-2">Lợi ích dự kiến</div>
          <h2 className="text-2xl font-semibold text-ink md:text-3xl">Mỗi bên nhận một việc rõ ràng</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <div key={b.who} className="flex flex-col gap-3 border-t-2 border-ink pt-4">
                <div className="flex items-center gap-2.5">
                  <Icon name={b.icon} size={20} className="text-forest" />
                  <h3 className="font-semibold text-ink">{b.who}</h3>
                </div>
                <ul className="flex flex-col gap-2 text-sm text-ink-2">
                  {b.points.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-2" aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">Đây là giá trị đề xuất. Thí điểm 3 trạm được thiết kế để kiểm chứng chúng.</p>
        </div>
      </section>

      {/* Pilot + roadmap */}
      <section className="mx-auto max-w-content px-4 py-12 sm:px-6 md:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.35fr]">
          <div className="min-w-0">
            <div className="eyebrow mb-2">Thí điểm đề xuất</div>
            <h2 className="text-2xl font-semibold text-ink md:text-3xl">3 trạm, 1 trường đại học, 3 tháng</h2>
            <p className="mt-3 text-ink-2">Chỉ nhận chai PET. Nửa đầu thu gom theo lịch cố định, nửa sau theo tuyến của RE Hub, để so sánh trên cùng địa điểm.</p>
            <div className="mt-5 rounded-lg border border-line bg-panel p-4">
              <div className="mb-2 text-sm font-semibold text-ink">Thí điểm sẽ đo</div>
              <ul className="grid gap-1.5 text-sm text-ink-2">
                {['Số kg giao cho bên tái chế, theo phiếu cân của bên mua', 'Tỷ lệ chai bị từ chối và lý do', 'Số kg mỗi chuyến và số km trên mỗi tấn', 'Tỷ lệ PET trong và PET màu', 'Chi phí trên mỗi kg'].map((m) => (
                  <li key={m} className="flex gap-2">
                    <Icon name="scale" size={16} className="mt-0.5 text-forest" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
            <img src={binSwap} alt="Ảnh dựng 3D: nhân viên kéo thùng chứa ra khỏi trạm để thay thùng" className="mt-5 hidden aspect-[16/10] w-full rounded-lg border border-line object-cover lg:block" loading="lazy" width={1200} height={750} />
          </div>
          <div className="min-w-0">
            <div className="eyebrow mb-2">Lộ trình</div>
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
                  className={`flex min-h-[64px] flex-col items-start justify-between rounded border px-3 py-2 text-left transition-colors ${
                    stage === r.id ? 'border-ink bg-ink text-paper' : r.projected ? 'border-dashed border-line-strong bg-paper text-ink hover:border-ink/50' : 'border-line-strong bg-panel text-ink hover:border-ink/50'
                  }`}
                >
                  <span className={`tnum font-mono text-[11px] ${stage === r.id ? 'text-paper/70' : 'text-muted'}`}>0{i + 1}</span>
                  <span className="text-sm font-semibold leading-tight">{r.label}</span>
                </button>
              ))}
            </div>
            <div id="rm-panel" role="tabpanel" aria-labelledby={`rm-${st.id}`} className="mt-3 rounded-lg border border-line bg-panel p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-ink">{st.label}</h3>
                <span className="text-sm text-muted">{st.when}</span>
                {st.projected ? <Badge tone="slate" icon="sparkle">Dự phóng</Badge> : <Badge tone="forest">Kế hoạch đề xuất</Badge>}
              </div>
              <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-muted">Phạm vi</dt>
                  <dd className="mt-1 text-ink-2">{st.scope}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-muted">Điều kiện chuyển giai đoạn</dt>
                  <dd className="mt-1 text-ink-2">{st.gate}</dd>
                </div>
              </dl>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-line p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name="checkCircle" size={17} className="text-forest" /> Đã có
                </div>
                <p className="mt-1 text-sm text-ink-2">Thiết kế 3D trạm (6 góc nhìn, mặt cắt kỹ thuật), thiết kế ý tưởng trạm xử lý, bản mẫu RE Hub này.</p>
              </div>
              <div className="rounded-lg border border-dashed border-line-strong p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon name="clock" size={17} className="text-slate" /> Chưa có
                </div>
                <p className="mt-1 text-sm text-ink-2">Mẫu thử vật lý, mạng lưới vận hành, đối tác đã ký, số liệu thí điểm.</p>
              </div>
            </div>
            <a href="#pilot" className="btn btn-ghost mt-4 -ml-2">
              Xem kịch bản kinh tế thí điểm
              <Icon name="arrowRight" size={17} />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
