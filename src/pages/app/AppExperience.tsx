import { useEffect, useState, type ReactNode } from 'react';
import type { Route } from '../../lib/router';
import { Icon, type IconName } from '../../components/icons';
import { Drawer } from '../../components/ui';
import { AppDemoProvider } from './appContext';
import { HomeScreen, StationsScreen, HistoryScreen, RewardsScreen } from './screens';
import { ReturnFlow } from './ReturnFlow';
import { DemoPanel } from './DemoPanel';
import { LiveStation } from './LiveStation';

const TABS: { href: string; name: Route['name']; label: string; icon: IconName }[] = [
  { href: '#app', name: 'app', label: 'Trang chủ', icon: 'home' },
  { href: '#app-stations', name: 'app-stations', label: 'Trạm', icon: 'mapPin' },
  { href: '#app-return', name: 'app-return', label: 'Trả chai', icon: 'bottle' },
  { href: '#app-history', name: 'app-history', label: 'Lịch sử', icon: 'history' },
  { href: '#app-rewards', name: 'app-rewards', label: 'Điểm', icon: 'gift' },
];

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
}

function TabBar({ current }: { current: Route['name'] }) {
  return (
    <nav aria-label="Điều hướng ứng dụng" className="grid shrink-0 grid-cols-5 border-t border-line bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {TABS.map((t) => {
        const active = current === t.name;
        const primary = t.name === 'app-return';
        return (
          <a
            key={t.name}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-forest' : 'text-muted hover:text-ink'}`}
          >
            {primary ? (
              <span className={`-mt-1 grid h-9 w-9 place-items-center rounded-full ${active ? 'bg-forest-ink' : 'bg-forest'} text-white shadow-1`}>
                <Icon name={t.icon} size={19} />
              </span>
            ) : (
              <Icon name={t.icon} size={21} strokeWidth={active ? 2.1 : 1.75} />
            )}
            {t.label}
          </a>
        );
      })}
    </nav>
  );
}

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'app-stations':
      return <StationsScreen />;
    case 'app-return':
      return <ReturnFlow />;
    case 'app-history':
      return <HistoryScreen />;
    case 'app-rewards':
      return <RewardsScreen />;
    default:
      return <HomeScreen />;
  }
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto w-[390px] max-w-full shrink-0 rounded-[34px] border-[9px] border-ink bg-ink shadow-3">
      <div className="flex h-[min(812px,calc(100vh-150px))] min-h-[600px] flex-col overflow-hidden rounded-[25px] bg-paper">{children}</div>
    </div>
  );
}

export function AppExperience({ route }: { route: Route }) {
  const framed = useMediaQuery('(min-width: 768px)');
  const wide = useMediaQuery('(min-width: 1280px)');
  const [demoOpen, setDemoOpen] = useState(false);
  const inFlow = route.name === 'app-return';

  const app = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div id="app-scroll" className={`min-h-0 flex-1 ${framed ? 'overflow-y-auto scroll-thin' : ''}`}>
        <Screen route={route} />
      </div>
      {!inFlow && <TabBar current={route.name} />}
    </div>
  );

  return (
    <AppDemoProvider>
      {framed ? (
        <main id="main" tabIndex={-1} className="min-h-[calc(100vh-44px)] bg-sunk/60 outline-none">
          <div className="mx-auto flex max-w-[1440px] items-start justify-center gap-6 px-4 py-6 xl:gap-8">
            {wide && (
              <aside aria-label="Trạm đang dùng (mô phỏng)" className="sticky top-[68px] w-[300px] shrink-0">
                <LiveStation />
              </aside>
            )}
            <div className="sticky top-[68px] shrink-0">
              <PhoneFrame>{app}</PhoneFrame>
              <p className="mt-3 text-center text-xs text-muted">Ứng dụng RE · bố cục di động 390 px</p>
            </div>
            <aside aria-label="Bảng điều khiển demo" className="w-[340px] min-w-0 shrink">
              <DemoPanel />
              {!wide && (
                <div className="mt-4">
                  <LiveStation compact />
                </div>
              )}
            </aside>
          </div>
        </main>
      ) : (
        <main id="main" tabIndex={-1} className="flex min-h-[calc(100dvh-44px)] flex-col bg-paper outline-none">
          {app}
          <button
            type="button"
            onClick={() => setDemoOpen(true)}
            className="on-dark fixed right-3 z-30 inline-flex h-11 items-center gap-1.5 rounded-full border border-paper/20 bg-ink px-4 text-sm font-semibold text-paper shadow-2"
            style={{ bottom: `calc(${inFlow ? 16 : 72}px + env(safe-area-inset-bottom, 0px))` }}
          >
            <Icon name="sliders" size={16} />
            Demo
          </button>
          <Drawer open={demoOpen} onClose={() => setDemoOpen(false)} title="Bảng điều khiển demo" width={420}>
            <DemoPanel embedded />
            <div className="mt-4">
              <LiveStation compact />
            </div>
          </Drawer>
        </main>
      )}
    </AppDemoProvider>
  );
}

/** Shared screen chrome inside the app: a top bar and an optional sticky action area. */
export function AppScreen({
  title,
  back,
  right,
  children,
  footer,
}: {
  title?: ReactNode;
  back?: { href?: string; onClick?: () => void; label: string };
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      {(title || back) && (
        <header className="sticky top-0 z-10 flex min-h-[52px] items-center gap-1 border-b border-line bg-paper/95 px-2 backdrop-blur-[2px]">
          {back ? (
            back.href ? (
              <a href={back.href} className="btn btn-quiet px-2" aria-label={back.label}>
                <Icon name="chevronLeft" size={20} />
              </a>
            ) : (
              <button type="button" onClick={back.onClick} className="btn btn-quiet px-2" aria-label={back.label}>
                <Icon name="x" size={20} />
              </button>
            )
          ) : (
            <span className="w-2" />
          )}
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">{title}</h1>
          {right}
        </header>
      )}
      <div className="flex-1 px-4 pb-6 pt-4">{children}</div>
      {footer && (
        <div className="sticky bottom-0 z-10 border-t border-line bg-paper px-4 pb-4 pt-3" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          {footer}
        </div>
      )}
    </div>
  );
}
