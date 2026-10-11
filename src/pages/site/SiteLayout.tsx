import { useMemo, useState, type ReactNode } from 'react';
import type { Route } from '../../lib/router';
import { Icon, Wordmark, type IconName } from '../../components/icons';
import { Drawer } from '../../components/ui';
import { useAppState } from '../../lib/store-context';
import { userStats } from '../../domain/ops';
import { SiteSearch } from './SiteSearch';
import { areaById, areaLabel } from '../../domain/areas';
import { AreaDialog, AreaPickerContext } from './AreaPicker';

/** Width of the store-style website. Wider than the product screens, like a shop front. */
export const SITE_WRAP = 'mx-auto w-full max-w-[1500px] px-4 sm:px-5';

/** Small trail above a page title, as shop pages show it. */
export function Breadcrumbs({ items }: { items: [string, string | null][] }) {
  return (
    <nav aria-label="Đường dẫn" className="text-xs text-shop-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map(([label, href], i) => (
          <li key={label} className="flex items-center gap-1">
            {i > 0 && <Icon name="chevronRight" size={12} />}
            {href ? (
              <a href={href} className="shop-link">
                {label}
              </a>
            ) : (
              <span aria-current="page">{label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const NAV = [
  { href: '#home', key: 'home', label: 'Giới thiệu' },
  { href: '#explorer', key: 'explorer', label: 'Trạm RE' },
  { href: '#pilot', key: 'pilot', label: 'Thí điểm & lộ trình' },
  { href: '#app', key: 'app', label: 'Ứng dụng trả chai' },
  { href: '#driver-map', key: 'driver', label: 'Tài xế thu gom' },
  { href: '#hub', key: 'hub', label: 'RE Hub' },
  { href: '#design', key: 'design', label: 'Hệ thống thiết kế' },
];

const MENU: { title: string; items: { href: string; label: string; icon: IconName }[] }[] = [
  {
    title: 'Trang web RE',
    items: [
      { href: '#home', label: 'Giới thiệu', icon: 'home' },
      { href: '#explorer', label: 'Bên trong trạm RE', icon: 'station' },
      { href: '#pilot', label: 'Thí điểm và lộ trình', icon: 'flag' },
    ],
  },
  {
    title: 'Ứng dụng trả chai',
    items: [
      { href: '#app-return', label: 'Trả chai', icon: 'bottle' },
      { href: '#app-stations', label: 'Tìm trạm', icon: 'mapPin' },
      { href: '#app-rewards', label: 'Điểm thưởng', icon: 'gift' },
      { href: '#app-history', label: 'Lịch sử trả chai', icon: 'history' },
    ],
  },
  {
    title: 'Tài xế thu gom',
    items: [
      { href: '#driver', label: 'Tuyến của tài xế', icon: 'truck' },
      { href: '#driver-map', label: 'Trạm gần nhất cho xe thu gom', icon: 'map' },
    ],
  },
  {
    title: 'RE Hub',
    items: [
      { href: '#hub', label: 'Tổng quan vận hành', icon: 'grid' },
      { href: '#hub-routes', label: 'Tuyến thu gom', icon: 'route' },
      { href: '#hub-trace', label: 'Truy xuất và báo cáo', icon: 'file' },
    ],
  },
  { title: 'Nhóm phát triển', items: [{ href: '#design', label: 'Hệ thống thiết kế', icon: 'layers' }] },
];

const FOOTER: { title: string; links: [string, string][] }[] = [
  { title: 'Tìm hiểu về RE', links: [['#home', 'Giới thiệu'], ['#explorer', 'Bên trong trạm RE'], ['#pilot', 'Thí điểm và lộ trình']] },
  { title: 'Người trả chai', links: [['#app-return', 'Trả chai'], ['#app-stations', 'Tìm trạm'], ['#app-rewards', 'Điểm thưởng']] },
  { title: 'Vận hành', links: [['#driver-map', 'Tài xế thu gom'], ['#hub', 'RE Hub'], ['#hub-trace', 'Truy xuất cho nhãn hàng']] },
  { title: 'Nhóm phát triển', links: [['#design', 'Hệ thống thiết kế']] },
];

function HeaderLink({ href, top, bottom, label }: { href: string; top: string; bottom: string; label?: string }) {
  return (
    <a href={href} aria-label={label} className="shop-nav-item hidden min-w-0 flex-col justify-center px-2 py-1 leading-tight lg:flex">
      <span className="truncate text-xs text-[#CCCCCC]">{top}</span>
      <span className="truncate text-sm font-bold text-white">{bottom}</span>
    </a>
  );
}

export function SiteLayout({ route, children }: { route: Route; children: ReactNode }) {
  const state = useAppState();
  const [menu, setMenu] = useState(false);
  const user = state.users.find((u) => u.id === state.currentUserId);
  const bottles = useMemo(() => userStats(state, state.currentUserId, 0).acceptedBottles, [state]);
  const hello = `Xin chào, ${user?.label ?? 'bạn'}`;
  const [areaOpen, setAreaOpen] = useState(false);
  const area = `${areaLabel(areaById(state.settings.areaId))} · minh họa`;

  return (
    <AreaPickerContext.Provider value={() => setAreaOpen(true)}>
      <div className="min-h-screen bg-shop-ground text-shop-text">
        <header className="on-dark">
          {/* Row 1: mark, area, search, account and bottles */}
          <div className="bg-shop-nav text-white">
            <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-1 gap-y-2 px-3 py-2 sm:px-4 md:flex-nowrap md:py-1.5">
              <a href="#home" className="shop-nav-item shrink-0 px-1.5 py-1" aria-label="RE, trang chủ">
                <Wordmark tone="paper" sub="Thu hồi chai PET" size={26} />
              </a>
              <button type="button" onClick={() => setAreaOpen(true)} aria-haspopup="dialog" className="shop-nav-item hidden shrink-0 items-end gap-1 px-2 py-1 text-left xl:flex">
                <Icon name="mapPin" size={18} className="mb-0.5 text-white" />
                <span className="flex flex-col leading-tight">
                  <span className="text-xs text-[#CCCCCC]">Trạm gần bạn</span>
                  <span className="text-sm font-bold">{area}</span>
                </span>
              </button>
              <div className="order-last flex w-full min-w-0 md:order-none md:mx-2 md:w-auto md:flex-1">
                <SiteSearch />
              </div>
              <div className="ml-auto flex min-w-0 items-center gap-0.5 md:ml-0">
                <HeaderLink href="#app" top={hello} bottom="Tài khoản & điểm" />
                <HeaderLink href="#app-return" top="Trả chai" bottom="ngay tại trạm" />
                <a href="#app" className="shop-nav-item flex items-center gap-1 px-2 py-1 text-sm lg:hidden" aria-label={hello}>
                  <span className="max-w-[9rem] truncate">{user?.label ?? 'Tài khoản'}</span>
                  <Icon name="user" size={22} />
                </a>
                <a href="#app-history" aria-label={`${bottles} chai đã trả`} className="shop-nav-item flex items-end gap-1 px-2 py-1">
                  <span className="relative pr-3">
                    <Icon name="bottle" size={30} strokeWidth={1.6} />
                    <span className="tnum absolute -top-1 left-4 rounded-full bg-shop-cta-2 px-1.5 text-center text-[12px] font-bold leading-[18px] text-shop-text">{bottles}</span>
                  </span>
                  <span className="hidden text-sm font-bold sm:inline">Chai đã trả</span>
                </a>
              </div>
            </div>
          </div>

          {/* Row 2: "Tất cả" menu and sections */}
          <nav aria-label="Điều hướng chính" className="bg-shop-nav-2 text-white">
            <div className="mx-auto flex h-10 max-w-[1500px] items-center gap-0.5 overflow-x-auto px-2 text-sm scroll-thin sm:px-3">
              <button type="button" onClick={() => setMenu(true)} className="shop-nav-item flex shrink-0 items-center gap-1.5 px-2 py-1 font-bold" aria-haspopup="dialog">
                <Icon name="menu" size={20} />
                Tất cả
              </button>
              {NAV.map((n) => (
                <a
                  key={n.key}
                  href={n.href}
                  aria-current={route.name === n.key ? 'page' : undefined}
                  className={`shop-nav-item shrink-0 whitespace-nowrap px-2 py-1 ${route.name === n.key ? 'font-bold underline decoration-shop-cta-2 decoration-2 underline-offset-[5px]' : ''}`}
                >
                  {n.label}
                </a>
              ))}
              <span className="ml-auto hidden shrink-0 whitespace-nowrap px-2 font-bold xl:inline">Mô hình đề xuất · PCIC 2026</span>
            </div>
          </nav>

          {/* Below desktop width: area strip under the search, as shop apps do */}
          <button type="button" onClick={() => setAreaOpen(true)} aria-haspopup="dialog" className="flex w-full items-center gap-1.5 bg-shop-nav-3 px-4 py-2 text-left text-[13px] text-white xl:hidden">
            <Icon name="mapPin" size={16} />
            Trạm gần bạn: <span className="font-semibold">{area}</span>
            <Icon name="chevronDown" size={14} className="ml-0.5" />
          </button>
        </header>

        <Drawer
          open={menu}
          onClose={() => setMenu(false)}
          side="left"
          width={365}
          headerClassName="bg-shop-nav-2 text-white [&_button:hover]:bg-white/10 [&_button]:text-white"
          title={
            <span className="flex items-center gap-2.5 text-lg font-bold">
              <Icon name="user" size={24} />
              {hello}
            </span>
          }
        >
          <div className="-mx-5 -my-4 bg-white">
            {MENU.map((g) => (
              <section key={g.title} className="border-b border-shop-line py-2 last:border-0">
                <h3 className="px-6 pb-1 pt-2 text-[17px] font-bold text-shop-text">{g.title}</h3>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <a href={it.href} onClick={() => setMenu(false)} className="flex min-h-[44px] items-center gap-3 px-6 text-[14px] text-shop-text hover:bg-[#EAEDED]">
                        <Icon name={it.icon} size={18} className="text-shop-muted" />
                        <span className="flex-1">{it.label}</span>
                        <Icon name="chevronRight" size={16} className="text-shop-muted" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Drawer>

        <main id="main" tabIndex={-1} className="outline-none">
          {children}
        </main>

        <footer className="on-dark mt-10 text-white">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
            className="block w-full bg-shop-nav-3 py-4 text-center text-[13px] hover:bg-[#485769]"
          >
            Lên đầu trang
          </button>
          <div className="bg-shop-nav-2">
            <div className={`${SITE_WRAP} grid grid-cols-2 gap-8 py-10 md:grid-cols-4 lg:max-w-[1000px]`}>
              {FOOTER.map((c) => (
                <div key={c.title} className="min-w-0">
                  <h2 className="mb-2 font-bold">{c.title}</h2>
                  <ul className="flex flex-col gap-1.5 text-sm text-[#DDDDDD]">
                    {c.links.map(([href, label]) => (
                      <li key={href}>
                        <a href={href} className="hover:underline">
                          {label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/10 bg-shop-nav">
            <div className={`${SITE_WRAP} flex flex-col items-center gap-3 py-8 text-center`}>
              <Wordmark tone="paper" sub="Hệ thống thu hồi chai PET thông minh" />
              <span className="text-xs text-[#CCCCCC]">Mô hình đề xuất · PCIC 2026</span>
              <p className="max-w-[78ch] text-xs leading-relaxed text-[#CCCCCC]">
                RE là ý tưởng dự thi của một nhóm sinh viên, chưa có mẫu thử vật lý và chưa vận hành. Trang này là bản mẫu tương tác: sự kiện phần cứng, nhận diện, định tuyến, điểm
                thưởng và hồ sơ đều được mô phỏng trong trình duyệt bằng dữ liệu demo. Không có lời chứng thực, đối tác, giải thưởng hay số liệu vận hành nào được trình bày ở đây.
              </p>
            </div>
          </div>
        </footer>
        <AreaDialog open={areaOpen} onClose={() => setAreaOpen(false)} />
      </div>
    </AreaPickerContext.Provider>
  );
}
