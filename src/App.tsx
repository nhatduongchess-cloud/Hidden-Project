import { useEffect, useState } from 'react';
import { useRoute, experienceOf, hrefOf, type Experience, type Route } from './lib/router';
import { useStore } from './lib/store-context';
import { Icon, type IconName } from './components/icons';
import { Button, Dialog, ToastHost, toast } from './components/ui';
import { SiteLayout } from './pages/site/SiteLayout';
import { Landing } from './pages/site/Landing';
import { Explorer } from './pages/site/Explorer';
import { PilotPage } from './pages/site/Pilot';
import { DesignSystem } from './pages/design/DesignSystem';
import { AppExperience } from './pages/app/AppExperience';
import { DriverExperience } from './pages/driver/Driver';
import { DriverMap } from './pages/driver/DriverMap';
import { Navigation } from './pages/driver/Navigation';
import { HubLayout } from './pages/hub/HubLayout';

const EXPERIENCES: { id: Experience; label: string; short: string; href: string; icon: IconName }[] = [
  { id: 'site', label: 'Website', short: 'Website', href: '#home', icon: 'monitor' },
  { id: 'app', label: 'Ứng dụng trả chai', short: 'Ứng dụng', href: '#app', icon: 'phone' },
  { id: 'driver', label: 'Tài xế', short: 'Tài xế', href: '#driver', icon: 'truck' },
  { id: 'hub', label: 'RE Hub', short: 'RE Hub', href: '#hub', icon: 'grid' },
  { id: 'design', label: 'Hệ thống thiết kế', short: 'Thiết kế', href: '#design', icon: 'layers' },
];

/** Prototype chrome: switches between the four experiences. Visually separate from the product UI. */
function PrototypeBar({ current, onReset }: { current: Experience; onReset: () => void }) {
  return (
    <div className="on-dark no-print sticky top-0 z-40 bg-ink text-paper" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <span className="hidden shrink-0 items-center gap-2 lg:flex">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-paper/60">Bản mẫu tương tác</span>
          <span className="rounded-sm border border-paper/25 px-1.5 py-px font-mono text-[10px] uppercase tracking-wider text-paper/80">Dữ liệu demo</span>
        </span>
        <nav aria-label="Chọn trải nghiệm" className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scroll-thin lg:justify-center">
          {EXPERIENCES.map((e) => (
            <a
              key={e.id}
              href={e.href}
              aria-current={current === e.id ? 'page' : undefined}
              title={e.label}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2.5 text-[12.5px] font-medium transition-colors ${
                current === e.id ? 'bg-paper text-ink' : 'text-paper/75 hover:bg-paper/10 hover:text-paper'
              }`}
            >
              <Icon name={e.icon} size={14} />
              <span className={current === e.id ? 'sm:hidden' : 'sr-only'}>{e.short}</span>
              <span className="hidden sm:inline">{e.label}</span>
            </a>
          ))}
        </nav>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm px-2 text-[12.5px] font-medium text-paper/80 hover:bg-paper/10 hover:text-paper"
          aria-label="Đặt lại dữ liệu demo"
        >
          <Icon name="refresh" size={14} />
          <span className="hidden md:inline">Đặt lại demo</span>
        </button>
      </div>
    </div>
  );
}

function routeTitle(r: Route): string {
  const map: Partial<Record<Route['name'], string>> = {
    home: 'RE · Thu hồi chai PET',
    explorer: 'Khám phá trạm RE',
    pilot: 'Thí điểm và lộ trình · RE',
    design: 'Hệ thống thiết kế · RE',
    app: 'Ứng dụng RE',
    'app-stations': 'Tìm trạm · Ứng dụng RE',
    'app-return': 'Trả chai · Ứng dụng RE',
    'app-history': 'Lịch sử · Ứng dụng RE',
    'app-rewards': 'Điểm thưởng · Ứng dụng RE',
    driver: 'Tuyến của tôi · Tài xế RE',
    'driver-map': 'Trạm gần nhất · Tài xế RE',
    'driver-nav': `Dẫn đường tới ${r.param ?? ''} · Tài xế RE`,
    hub: 'Tổng quan · RE Hub',
    'hub-stations': 'Trạm thu gom · RE Hub',
    'hub-station': `${r.param ?? 'Trạm'} · RE Hub`,
    'hub-routes': 'Tuyến thu gom · RE Hub',
    'hub-analytics': 'Số lượng thu gom · RE Hub',
    'hub-forecasts': 'Dự báo mức đầy · RE Hub',
    'hub-kpis': 'Hiệu quả vận hành · RE Hub',
    'hub-transactions': 'Giao dịch · RE Hub',
    'hub-trace': 'Truy xuất và báo cáo · RE Hub',
    'hub-settings': 'Cài đặt · RE Hub',
  };
  return map[r.name] ?? 'RE';
}

export function App() {
  const route = useRoute();
  const store = useStore();
  const exp = experienceOf(route);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    document.title = routeTitle(route);
  }, [route]);

  let body;
  switch (exp) {
    case 'site':
      body = (
        <SiteLayout route={route}>
          {route.name === 'explorer' ? <Explorer key={route.param} part={route.param} /> : route.name === 'pilot' ? <PilotPage /> : <Landing />}
        </SiteLayout>
      );
      break;
    case 'design':
      body = <DesignSystem />;
      break;
    case 'app':
      body = <AppExperience route={route} />;
      break;
    case 'driver':
      body = route.name === 'driver-nav' ? <Navigation key={route.param} targetId={route.param ?? ''} /> : route.name === 'driver-map' ? <DriverMap /> : <DriverExperience />;
      break;
    case 'hub':
      body = <HubLayout route={route} />;
      break;
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-14 focus:z-[70] focus:rounded focus:bg-forest focus:px-3 focus:py-2 focus:text-white" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Bỏ qua đến nội dung chính
      </a>
      <PrototypeBar current={exp} onReset={() => setResetOpen(true)} />
      {body}
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Khôi phục dữ liệu demo?"
        footer={
          <>
            <Button onClick={() => setResetOpen(false)}>Hủy</Button>
            <Button
              variant="danger"
              icon="refresh"
              onClick={() => {
                store.reset();
                setResetOpen(false);
                toast('Đã khôi phục dữ liệu demo ban đầu.');
                location.hash = hrefOf(route).slice(1);
              }}
            >
              Khôi phục
            </Button>
          </>
        }
      >
        Mọi giao dịch, tuyến, yêu cầu và hồ sơ bạn tạo trong bản mẫu sẽ bị xóa. Dữ liệu chỉ lưu trong trình duyệt này.
      </Dialog>
      <ToastHost />
    </>
  );
}
