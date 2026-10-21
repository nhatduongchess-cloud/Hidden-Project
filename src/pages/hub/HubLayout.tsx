import { useEffect, useState, type ReactNode } from 'react';
import type { Route, RouteName } from '../../lib/router';
import { useAppState, useStore } from '../../lib/store-context';
import { attentionItems, activeRoute } from '../../domain/ops';
import type { AppState } from '../../domain/types';
import { Icon, Wordmark, type IconName } from '../../components/icons';
import { Alert, Drawer, Segmented, SelectField } from '../../components/ui';
import { HubFilterProvider, ATTN } from './shared';
import { Overview } from './Overview';
import { StationsList, StationDetail } from './Stations';
import { Routes } from './Routes';
import { Transactions } from './Transactions';
import { Trace } from './Trace';
import { HubSettings } from './Settings';
import { Analytics, Kpis } from './Analytics';
import { Forecasts } from './Forecasts';
import { Fleet } from './Fleet';

const NAV: { name: RouteName; href: string; label: string; icon: IconName; brand?: boolean }[] = [
  { name: 'hub', href: '#hub', label: 'Tổng quan', icon: 'grid' },
  { name: 'hub-stations', href: '#hub-stations', label: 'Trạm thu gom', icon: 'station' },
  { name: 'hub-analytics', href: '#hub-analytics', label: 'Số lượng thu gom', icon: 'bottle', brand: true },
  { name: 'hub-forecasts', href: '#hub-forecasts', label: 'Dự báo mức đầy', icon: 'clock' },
  { name: 'hub-routes', href: '#hub-routes', label: 'Tuyến thu gom', icon: 'route' },
  { name: 'hub-fleet', href: '#hub-fleet', label: 'Đội xe trực tiếp', icon: 'truck' },
  { name: 'hub-kpis', href: '#hub-kpis', label: 'Hiệu quả vận hành', icon: 'sliders' },
  { name: 'hub-transactions', href: '#hub-transactions', label: 'Giao dịch', icon: 'list', brand: true },
  { name: 'hub-trace', href: '#hub-trace', label: 'Truy xuất & báo cáo EPR', icon: 'layers', brand: true },
  { name: 'hub-settings', href: '#hub-settings', label: 'Cài đặt', icon: 'settings' },
];

function activeNav(r: Route): RouteName {
  return r.name === 'hub-station' ? 'hub-stations' : r.name;
}

function useWidth() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

function counts(state: AppState) {
  const items = attentionItems(state);
  return {
    stations: items.filter((i) => i.severity !== 'warn' || i.kind === 'warning').length,
    route: activeRoute(state) ? 1 : 0,
  };
}

function RoleSwitch() {
  const state = useAppState();
  const store = useStore();
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label="Xem với vai trò (demo)"
        name="hub-role"
        size="sm"
        value={state.role}
        onChange={(v) => {
          store.dispatch({ type: 'SET_ROLE', role: v });
          if (v === 'brand' && !['hub-transactions', 'hub-trace', 'hub-analytics'].some((n) => location.hash.startsWith(`#${n}`))) location.hash = 'hub-trace';
        }}
        options={[
          { value: 'operator', label: 'Vận hành' },
          { value: 'brand', label: 'Nhãn hàng' },
        ]}
      />
      {state.role === 'brand' && (
        <SelectField
          id="hub-brand-view"
          label="Nhãn hàng"
          hideLabel
          value={state.brandView}
          onChange={(v) => store.dispatch({ type: 'SET_ROLE', role: 'brand', brandView: v })}
          options={[
            { value: 'BRAND_A', label: 'Nhãn hàng minh họa A' },
            { value: 'BRAND_B', label: 'Nhãn hàng minh họa B' },
            { value: 'BRAND_C', label: 'Nhãn hàng minh họa C' },
          ]}
        />
      )}
      <p className="text-[11px] leading-snug text-muted">Chuyển vai trò để trình diễn, không phải đăng nhập.</p>
    </div>
  );
}

function NavList({ route, rail, onNavigate }: { route: Route; rail?: boolean; onNavigate?: () => void }) {
  const state = useAppState();
  const c = counts(state);
  const brand = state.role === 'brand';
  const cur = activeNav(route);
  return (
    <nav aria-label="RE Hub">
      <ul className={`flex flex-col ${rail ? 'gap-1' : 'gap-0.5'}`}>
        {NAV.filter((n) => !brand || n.brand).map((n) => {
          const on = cur === n.name;
          const badge = !brand && n.name === 'hub-stations' && c.stations > 0 ? c.stations : !brand && n.name === 'hub-routes' && c.route ? 1 : 0;
          return (
            <li key={n.name}>
              <a
                href={n.href}
                onClick={onNavigate}
                aria-current={on ? 'page' : undefined}
                title={rail ? n.label : undefined}
                className={
                  rail
                    ? `relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded px-1 text-center text-[10.5px] font-medium leading-tight ${on ? 'bg-forest-tint text-forest-ink' : 'text-ink-2 hover:bg-sunk'}`
                    : `flex min-h-[40px] items-center gap-2.5 rounded px-3 text-sm font-medium ${on ? 'bg-forest-tint text-forest-ink' : 'text-ink-2 hover:bg-sunk hover:text-ink'}`
                }
              >
                <Icon name={n.icon} size={rail ? 20 : 18} strokeWidth={on ? 2.1 : 1.75} />
                <span className={rail ? 'line-clamp-2' : 'flex-1'}>{n.label}</span>
                {badge > 0 &&
                  (rail ? (
                    <span className="tnum absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-paper">{badge}</span>
                  ) : (
                    <span className="tnum grid h-5 min-w-[20px] place-items-center rounded-full bg-ink px-1.5 text-[11px] font-bold text-paper" aria-label={`${badge} mục`}>
                      {badge}
                    </span>
                  ))}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Problems that stay on screen until resolved. Toasts are only used for brief confirmations. */
function OpsBanner({ route }: { route: Route }) {
  const state = useAppState();
  if (state.role !== 'operator') return null;
  const items = attentionItems(state).filter((i) => i.severity !== 'warn');
  const visible = route.name === 'hub' ? [] : items.filter((i) => !(route.name === 'hub-station' && route.param === i.stationId));
  if (!visible.length) return null;
  const stops = visible.filter((i) => i.severity === 'stop');
  const stale = visible.filter((i) => i.severity === 'stale');
  return (
    <div className="mb-5 flex flex-col gap-2" role="region" aria-label="Sự cố chưa xử lý">
      {stops.length > 0 && (
        <Alert
          tone="stop"
          title={`${stops.length} trạm không nhận chai`}
          actions={stops.map((i) => (
            <a key={i.stationId} href={`#hub-station-${i.stationId}`} className="btn btn-secondary btn-sm">
              {i.stationId} · {ATTN[i.kind].title(i.ops)}
            </a>
          ))}
        >
          Người dùng đang được hướng sang trạm khác cho đến khi xử lý xong.
        </Alert>
      )}
      {stale.length > 0 && (
        <Alert tone="stale" title={stale.map((i) => `${i.stationId} mất kết nối ${Math.round(i.ops.minutesSinceReading)} phút`).join(' · ')}>
          Số liệu của trạm là lần đọc cuối và có thể đã cũ.
        </Alert>
      )}
    </div>
  );
}

function BrandOnly() {
  const store = useStore();
  return (
    <div className="max-w-xl">
      <Alert
        tone="info"
        title="Trang này dành cho đơn vị vận hành"
        actions={
          <>
            <a href="#hub-trace" className="btn btn-primary btn-sm">
              Mở Truy xuất & báo cáo
            </a>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => store.dispatch({ type: 'SET_ROLE', role: 'operator' })}>
              Chuyển sang vai trò vận hành
            </button>
          </>
        }
      >
        Với vai trò nhãn hàng, bạn xem được Giao dịch và Truy xuất của nhãn hàng mình.
      </Alert>
    </div>
  );
}

function Page({ route }: { route: Route }) {
  const state = useAppState();
  const brand = state.role === 'brand';
  const brandOk = route.name === 'hub-transactions' || route.name === 'hub-trace' || route.name === 'hub-analytics';
  if (brand && !brandOk) return <BrandOnly />;
  switch (route.name) {
    case 'hub-fleet': return <Fleet />;
    case 'hub-analytics': return <Analytics />;
    case 'hub-forecasts': return <Forecasts />;
    case 'hub-kpis': return <Kpis />;
    case 'hub-stations':
      return <StationsList />;
    case 'hub-station':
      return <StationDetail id={route.param ?? ''} />;
    case 'hub-routes':
      return <Routes />;
    case 'hub-transactions':
      return <Transactions />;
    case 'hub-trace':
      return <Trace batchId={route.param} />;
    case 'hub-settings':
      return <HubSettings />;
    default:
      return <Overview />;
  }
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <a href="#hub" className="flex items-center gap-2" aria-label="RE Hub, tổng quan">
      <Wordmark size={compact ? 22 : 24} />
      {!compact && <span className="rounded-sm bg-ink px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-paper">Hub</span>}
    </a>
  );
}

export function HubLayout({ route }: { route: Route }) {
  const w = useWidth();
  const [menu, setMenu] = useState(false);
  const full = w >= 1100;
  const rail = !full && w >= 768;

  useEffect(() => setMenu(false), [route.name, route.param]);

  let shell: ReactNode;
  const content = (
    <main id="main" tabIndex={-1} className="min-w-0 flex-1 px-4 pb-16 pt-5 outline-none sm:px-6 lg:px-8 lg:pt-7">
      <div className="mx-auto max-w-[1240px]">
        <OpsBanner route={route} />
        <Page route={route} />
      </div>
    </main>
  );

  if (full) {
    shell = (
      <div className="flex min-h-[calc(100vh-44px)]">
        <aside className="sticky top-11 flex h-[calc(100vh-44px)] w-[240px] shrink-0 flex-col border-r border-line bg-panel px-3 py-4">
          <div className="px-2 pb-5">
            <Brand />
          </div>
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-muted">Điều hành thu gom</p>
          <NavList route={route} />
          <a href="#driver" className="ops-driver-link"><Icon name="truck" size={20}/><span>Màn hình tài xế<small>Tuyến đường & thay thùng</small></span><Icon name="chevronRight" size={15}/></a>
          <div className="mt-auto border-t border-line px-1 pt-4">
            <RoleSwitch />
          </div>
        </aside>
        {content}
      </div>
    );
  } else if (rail) {
    shell = (
      <div className="flex min-h-[calc(100vh-44px)]">
        <aside className="sticky top-11 flex h-[calc(100vh-44px)] w-[84px] shrink-0 flex-col items-stretch border-r border-line bg-panel px-1.5 py-3">
          <div className="mb-3 flex justify-center">
            <Brand compact />
          </div>
          <NavList route={route} rail />
          <button type="button" onClick={() => setMenu(true)} className="mt-auto flex min-h-[48px] flex-col items-center justify-center gap-1 rounded text-[10.5px] font-medium text-ink-2 hover:bg-sunk">
            <Icon name="users" size={18} />
            Vai trò
          </button>
        </aside>
        {content}
        <Drawer open={menu} onClose={() => setMenu(false)} title="Vai trò demo" width={360}>
          <RoleSwitch />
        </Drawer>
      </div>
    );
  } else {
    shell = (
      <div className="min-h-[calc(100vh-44px)]">
        <header className="sticky top-11 z-20 flex h-14 items-center justify-between border-b border-line bg-panel/95 px-4">
          <Brand />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMenu(true)} aria-expanded={menu}>
            <Icon name="menu" size={18} />
            {NAV.find((n) => n.name === activeNav(route))?.label ?? 'Menu'}
          </button>
        </header>
        {content}
        <Drawer open={menu} onClose={() => setMenu(false)} title="RE Hub" width={340}>
          <NavList route={route} onNavigate={() => setMenu(false)} />
          <div className="mt-6 border-t border-line pt-4">
            <RoleSwitch />
          </div>
        </Drawer>
      </div>
    );
  }

  return <HubFilterProvider><div className="ops-shell">{shell}</div></HubFilterProvider>;
}
