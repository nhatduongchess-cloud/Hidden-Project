import { useEffect, useRef, useState } from 'react';
import { fleetRequest, type FleetSnapshot, type LivePosition } from '../integrations/fleet';

export function useFleetLive(key: string) {
  const [fleet, setFleet] = useState<FleetSnapshot | null>(null);
  const [connection, setConnection] = useState('Chưa kết nối');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    setFleet(null);
    if (!key) { setConnection('Chưa kết nối'); return; }
    let disposed = false, socket: WebSocket | undefined, timer: ReturnType<typeof setTimeout>, retry = 1000, offset = 0, lastMessage = Date.now();
    const ticker = setInterval(() => {
      setNow(Date.now() + offset);
      if (socket?.readyState === WebSocket.OPEN && Date.now() - lastMessage > 35000) socket.close();
    }, 1000);
    const connect = () => {
      if (disposed) return;
      setConnection('Đang kết nối lại…');
      socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`);
      socket.onopen = () => { lastMessage = Date.now(); socket?.send(JSON.stringify({ key })); };
      socket.onmessage = (event) => {
        if (disposed) return;
        const data = JSON.parse(event.data) as FleetSnapshot;
        lastMessage = Date.now();
        offset = data.serverTime - Date.now();
        setNow(data.serverTime); setFleet(data); setConnection('Đã kết nối trực tiếp'); retry = 1000;
      };
      socket.onclose = (event) => {
        if (disposed) return;
        if (event.code === 4401) { setConnection('Khóa đã hết hiệu lực. Hãy kết nối lại.'); return; }
        setConnection('Mất kết nối · đang thử lại');
        timer = setTimeout(connect, retry); retry = Math.min(retry * 2, 15000);
      };
      socket.onerror = () => socket?.close();
    };
    connect();
    return () => { disposed = true; clearTimeout(timer); clearInterval(ticker); socket?.close(); };
  }, [key]);
  return { fleet, setFleet, connection, now };
}

/** Only the latest unsent fix is retained. There is never an offline location history. */
export function useGpsSender(token: string) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [lastSent, setLastSent] = useState<number | null>(null);
  const [position, setPosition] = useState<LivePosition | null>(null);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!sharing || !token) return;
    let active = true, pending: Omit<LivePosition, 'tracking' | 'receivedAt'> | null = null;
    let sending: Promise<void> | null = null, lastAttempt = 0;
    const flush = () => {
      if (!active || sending || !pending || !navigator.onLine || Date.now() - lastAttempt < 5000) return;
      const fix = pending;
      pending = null; lastAttempt = Date.now();
      sending = fleetRequest<{ receivedAt: number }>('/driver/position', token, fix).then((res) => {
        if (active) { setLastSent(res.receivedAt); setPosition({ ...fix, receivedAt: res.receivedAt, tracking: true }); setError(''); }
      }).catch((e: Error) => {
        if (active) { if (!pending && Date.now() - fix.recordedAt < 120000) pending = fix; setError(e.message); }
      }).finally(() => { sending = null; });
    };
    const watch = navigator.geolocation.watchPosition((p) => {
      if (!active) return;
      pending = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy,
        heading: Number.isFinite(p.coords.heading) ? p.coords.heading : null,
        speed: Number.isFinite(p.coords.speed) ? p.coords.speed : null, recordedAt: p.timestamp };
      flush();
    }, (e) => {
      setError(e.code === 1 ? 'Chưa được cấp quyền vị trí. Cho phép vị trí trong trình duyệt rồi bật lại.' : 'Chưa lấy được GPS. Đưa điện thoại đến nơi thoáng và giữ màn hình mở.');
      if (e.code === 1) setSharing(false);
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    const timer = setInterval(flush, 1000);
    const stop = async () => {
      if (!active) return;
      active = false; pending = null; clearInterval(timer); navigator.geolocation.clearWatch(watch);
      await sending;
      await fleetRequest('/driver/action', token, { action: 'stop' }).catch(() => {});
    };
    stopRef.current = stop;
    return () => { void stop(); };
  }, [token, sharing]);
  return { sharing, error, lastSent, position,
    start: () => { if (!navigator.geolocation || !window.isSecureContext) { setError('Vị trí cần HTTPS hoặc localhost và trình duyệt hỗ trợ GPS.'); return; } setError(''); setSharing(true); },
    stop: async () => { await stopRef.current(); setSharing(false); },
  };
}
