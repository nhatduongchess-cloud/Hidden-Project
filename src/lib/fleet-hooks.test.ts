import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFleetLive } from './fleet-hooks';
import { positionState, type FleetSnapshot } from '../integrations/fleet';

class Socket {
  static OPEN = 1;
  static instances: Socket[] = [];
  readyState = 0;
  onopen?: () => void;
  onmessage?: (event: { data: string }) => void;
  onclose?: (event: { code: number }) => void;
  onerror?: () => void;
  sent: string[] = [];
  constructor() { Socket.instances.push(this); }
  send(data: string) { this.sent.push(data); }
  open() { this.readyState = 1; this.onopen?.(); }
  close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
  receive(data: FleetSnapshot) { this.onmessage?.({ data: JSON.stringify(data) }); }
}

describe('fleet WebSocket lifecycle', () => {
  let root: Root, element: HTMLDivElement, current: ReturnType<typeof useFleetLive>;
  const snapshot = (revision: number): FleetSnapshot => ({ revision, plan: null, positions: {}, serverTime: Date.now() });
  function View() { current = useFleetLive('private-key'); return null; }
  beforeEach(() => {
    vi.useFakeTimers(); vi.stubGlobal('WebSocket', Socket); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Socket.instances = []; element = document.createElement('div'); document.body.appendChild(element);
    root = createRoot(element); act(() => root.render(createElement(View)));
  });
  afterEach(() => { act(() => root.unmount()); element.remove(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('authenticates before subscribing and restores snapshot after reconnect', () => {
    const first = Socket.instances[0];
    act(() => { first.open(); first.receive(snapshot(4)); });
    expect(JSON.parse(first.sent[0])).toEqual({ key: 'private-key' });
    expect(current.fleet?.revision).toBe(4);
    act(() => first.close());
    expect(current.connection).toContain('Mất kết nối');
    act(() => vi.advanceTimersByTime(1000));
    expect(Socket.instances).toHaveLength(2);
    act(() => { Socket.instances[1].open(); Socket.instances[1].receive(snapshot(9)); });
    expect(current.connection).toBe('Đã kết nối trực tiếp');
    expect(current.fleet?.revision).toBe(9);
  });

  it('detects a silent open socket instead of showing it as live indefinitely', () => {
    act(() => { Socket.instances[0].open(); Socket.instances[0].receive(snapshot(0)); });
    act(() => vi.advanceTimersByTime(36000));
    expect(Socket.instances[0].readyState).toBe(3);
    expect(current.connection).toContain('Mất kết nối');
  });

  it('does not retry invalid credentials', () => {
    act(() => { Socket.instances[0].open(); Socket.instances[0].close(4401); vi.advanceTimersByTime(60000); });
    expect(Socket.instances).toHaveLength(1);
    expect(current.connection).toContain('Khóa đã hết hiệu lực');
  });
});

it('separates missing, stale and deliberately paused GPS', () => {
  const p = { lat: 10, lng: 106, accuracy: 10, heading: null, speed: null, recordedAt: 1000, receivedAt: 1000, tracking: true };
  expect(positionState(undefined, 1000)).toBe('Chưa có GPS');
  expect(positionState(p, 5000)).toBe('Đang cập nhật');
  expect(positionState(p, 31001)).toBe('Mất tín hiệu');
  expect(positionState({ ...p, tracking: false }, 5000)).toBe('Đã dừng chia sẻ');
});
