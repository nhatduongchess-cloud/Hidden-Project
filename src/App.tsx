import { useEffect } from 'react';
import { useRoute, type Route } from './lib/router';
import { ToastHost } from './components/ui';
import { DriverExperience } from './pages/driver/Driver';
import { DriverMap } from './pages/driver/DriverMap';
import { Navigation } from './pages/driver/Navigation';
import { LiveDriver } from './pages/driver/LiveDriver';
import { HubLayout } from './pages/hub/HubLayout';

function routeTitle(r: Route): string {
  const map: Partial<Record<Route['name'], string>> = {
    driver: 'Tuyến của tôi · Tài xế RE',
    'driver-map': 'Trạm gần nhất · Tài xế RE',
    'driver-live': 'Chuyến được giao · Tài xế RE',
    'hub-fleet': 'Đội xe trực tiếp · RE Hub',
    'driver-nav': `Dẫn đường tới ${r.param ?? ''} · Tài xế RE`,
    hub: 'Tổng quan · RE Hub',
    'hub-map': 'Bản đồ trạm · RE Hub',
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
  return map[r.name] ?? 'RE Hub';
}

export function App() {
  const route = useRoute();
  useEffect(() => {
    document.title = routeTitle(route);
  }, [route]);

  const body = route.name === 'driver-live' ? <LiveDriver key={route.param} initialToken={route.param} />
    : route.name === 'driver-nav' ? <Navigation key={route.param} targetId={route.param ?? ''} />
    : route.name === 'driver-map' ? <DriverMap />
    : route.name === 'driver' ? <DriverExperience />
    : <HubLayout route={route} />;
  return <>
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:bg-forest focus:px-3 focus:py-2 focus:text-white" onClick={(event) => {
      event.preventDefault(); document.getElementById('main')?.focus();
    }}>Bỏ qua đến nội dung chính</a>
    {body}
    <ToastHost />
  </>;
}
