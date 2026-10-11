import { useState } from 'react';
import { StationIllustration, ZONES, type ZoneId } from '../../components/StationIllustration';
import { Icon } from '../../components/icons';
import { Badge, Segmented, OP_META } from '../../components/ui';
import { CUTAWAY_ONLY, NAMES, ZONE_INFO, isZone } from './zones';
import { Breadcrumbs, SITE_WRAP } from './SiteLayout';

/** Station explorer, laid out like a product page: the drawing, the parts, and a side box to try the fill level. */
export function Explorer({ part }: { part?: string }) {
  const first: ZoneId = isZone(part) ? part : 'inspection';
  const [view, setView] = useState<'exterior' | 'cutaway'>('cutaway');
  const [zone, setZone] = useState<ZoneId>(first);
  const [fill, setFill] = useState(62);
  const pick = (z: ZoneId) => {
    setZone(z);
    if (view === 'exterior' && CUTAWAY_ONLY.includes(z)) setView('cutaway');
  };
  const info = ZONE_INFO[zone];
  const op = fill >= 95 ? 'stopped' : fill >= 80 ? 'warning' : 'accepting';

  return (
    <div className={`${SITE_WRAP} flex flex-col gap-4 pt-4`}>
      <Breadcrumbs items={[['Trang chủ', '#home'], ['Trạm RE', '#explorer'], [isZone(part) ? info.name : 'Bên trong trạm', null]]} />

      <div className="shop-card grid gap-6 p-5 md:grid-cols-[minmax(260px,380px)_1fr] lg:grid-cols-[minmax(280px,400px)_1fr_280px] lg:gap-8">
        {/* Drawing, with the view switch like product photo thumbnails */}
        <div className="min-w-0 md:col-start-1 md:row-start-1">
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
          <div className="mx-auto max-w-[300px] rounded-sm border border-shop-line bg-[#F7F8F8] p-3 md:max-w-none">
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
          <p className="mt-2 text-xs text-shop-muted">Chạm vào số trên hình để chọn bộ phận.</p>
        </div>

        {/* Side box: try the fill level, then go further */}
        <aside aria-label="Thử mức đầy thùng" className="flex h-fit flex-col gap-3 rounded-lg border border-shop-line p-4 md:col-start-1 md:row-start-2 lg:col-start-3 lg:row-start-1">
          <label htmlFor="fill-try" className="flex items-center justify-between gap-2 text-sm font-bold text-shop-text">
            Thử mức đầy thùng
            <span className="tnum text-[22px] font-medium">{fill} %</span>
          </label>
          <input id="fill-try" type="range" min={0} max={100} value={fill} onChange={(e) => setFill(Number(e.target.value))} className="w-full accent-[rgb(var(--c-forest))]" />
          <Badge tone={OP_META[op].tone} icon={OP_META[op].icon} className="self-start">
            {OP_META[op].label}
          </Badge>
          <p className="text-sm text-shop-text">Ở 80 %, RE Hub đưa trạm vào danh sách cần thu gom. Ở 95 %, trạm tự dừng nhận và màn hình không hiện mã QR.</p>
          <a href="#app-return" className="btn btn-shop w-full">
            Thử trả một chai
          </a>
          <a href="#hub-stations" className="btn btn-shop-alt w-full">
            Xem trạm trong RE Hub
          </a>
          <p className="text-xs text-shop-muted">Bản vẽ theo hồ sơ thiết kế; chưa có mẫu thử vật lý.</p>
        </aside>

        {/* Title and parts */}
        <div className="min-w-0 md:col-start-2 md:row-span-2 md:row-start-1 lg:row-span-1">
          <h1 className="text-2xl font-medium leading-snug text-shop-text md:text-[28px]">Bên trong trạm RE</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="slate" icon="sparkle">
              Mô hình đề xuất
            </Badge>
            <span className="tnum text-shop-muted">800 × 800 × 1.800 mm · 5 bộ phận</span>
          </div>
          <p className="mt-3 max-w-[68ch] text-sm text-shop-text">
            Chạm vào số để xem từng bộ phận. Bản vẽ theo tỷ lệ 800 × 800 × 1.800 mm từ hồ sơ thiết kế; đây là ý tưởng, chưa có mẫu thử vật lý.
          </p>
          <hr className="my-4 border-shop-line" />
          <h2 className="mb-2 font-bold text-shop-text">Bộ phận của trạm</h2>
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
                    className={`flex min-h-[52px] w-full items-center gap-3 rounded-md border px-3.5 text-left transition-colors ${sel ? 'border-shop-link bg-[#F0F8F9] shadow-[0_0_0_1px_rgb(var(--c-shop-link))]' : 'border-shop-line bg-white hover:bg-[#F7FAFA]'}`}
                  >
                    <span className={`tnum grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${sel ? 'bg-forest text-white' : 'border-2 border-forest text-forest'}`}>{i + 1}</span>
                    <Icon name={zi.icon} size={18} className="text-shop-muted" />
                    <span className="flex-1 font-semibold text-shop-text">{zi.name}</span>
                    {CUTAWAY_ONLY.includes(z) && <span className="hidden text-xs text-shop-muted sm:inline">chỉ thấy ở mặt cắt</span>}
                    <Icon name="chevronDown" size={16} className={`text-shop-muted transition-transform ${sel ? 'rotate-180' : ''}`} />
                  </button>
                  {sel && (
                    <div className="rise rounded-b-md border-x border-b border-shop-line px-4 pb-4 pt-3" aria-live="polite">
                      <p className="text-shop-text">{zi.summary}</p>
                      <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                        {zi.facts.map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="font-bold text-shop-text">{k}</dt>
                            <dd className="tnum text-shop-text">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-shop-text">
                        {zi.notes.map((n) => (
                          <li key={n} className="flex gap-2">
                            <Icon name="info" size={15} className="mt-0.5 shrink-0 text-info" />
                            {n}
                          </li>
                        ))}
                      </ul>
                      {zi.image && (
                        <figure className="mt-4">
                          <img src={zi.image.src} alt={zi.image.alt} loading="lazy" className="aspect-[16/10] w-full rounded-sm object-cover" width={1200} height={750} />
                          <figcaption className="mt-1 text-xs text-shop-muted">Ảnh dựng từ hồ sơ thiết kế</figcaption>
                        </figure>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <section aria-labelledby="not-do" className="shop-card p-5">
        <h2 id="not-do" className="font-bold text-shop-text">
          Trạm không làm những việc này
        </h2>
        <ul className="mt-2 grid gap-1.5 text-sm text-shop-text sm:grid-cols-3">
          <li className="flex gap-2">
            <Icon name="x" size={16} className="mt-0.5 shrink-0 text-fault-ink" /> Rửa chai. Rửa thuộc trạm xử lý phía sau.
          </li>
          <li className="flex gap-2">
            <Icon name="x" size={16} className="mt-0.5 shrink-0 text-fault-ink" /> Tách màu ra thùng riêng trong thí điểm.
          </li>
          <li className="flex gap-2">
            <Icon name="x" size={16} className="mt-0.5 shrink-0 text-fault-ink" /> Nhận HDPE. HDPE thuộc lộ trình sau.
          </li>
        </ul>
      </section>
    </div>
  );
}
