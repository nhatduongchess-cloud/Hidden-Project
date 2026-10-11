import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppState, useStore } from '../../lib/store-context';
import { canAcceptNext } from '../../domain/selectors';
import { DEMO_DISTANCE_M } from '../../domain/constants';
import type { Station } from '../../domain/types';
import { Icon, type IconName } from '../../components/icons';
import { Badge, Button, Spinner } from '../../components/ui';
import { n0 } from '../../lib/format';
import { useT } from '../../i18n';
import { AppScreen } from './AppExperience';
import { useAppDemo } from './appContext';
import { availability, AVAIL, sortedStations } from './screens';

type Screen = 'choose' | 'scan' | 'insert' | 'inspecting' | 'processing' | 'stored' | 'returned' | 'full' | 'fault' | 'summary';

const STEPS = ['Định danh', 'Đặt chai', 'Kiểm tra', 'Xử lý', 'Hoàn tất'];
const STEP_OF: Record<Screen, number> = { choose: 0, scan: 0, insert: 1, inspecting: 2, processing: 3, returned: 3, full: 0, fault: 3, stored: 4, summary: 4 };

function Progress({ screen }: { screen: Screen }) {
  const at = STEP_OF[screen];
  return (
    <ol className="mb-5 grid grid-cols-5 gap-1" aria-label="Tiến trình trả chai">
      {STEPS.map((s, i) => (
        <li key={s} className="min-w-0" aria-current={i === at ? 'step' : undefined}>
          <div className={`h-1 rounded-full ${i < at ? 'bg-forest' : i === at ? 'bg-ink' : 'bg-line'}`} />
          <div className={`mt-1 truncate text-[10.5px] font-medium ${i === at ? 'text-ink' : 'text-muted'}`}>{s}</div>
        </li>
      ))}
    </ol>
  );
}

/** One dominant instruction per step. */
function Instruction({ icon, tone = 'ink', title, children }: { icon: IconName; tone?: 'ink' | 'forest' | 'fault' | 'amber' | 'slate'; title: string; children?: ReactNode }) {
  const ring = { ink: 'bg-sunk text-ink', forest: 'bg-forest text-white', fault: 'bg-fault-tint text-fault-ink', amber: 'bg-amber-tint text-amber-ink', slate: 'bg-slate-tint text-slate' }[tone];
  return (
    <div className="rise flex flex-col items-center text-center" aria-live="polite">
      <span className={`grid h-16 w-16 place-items-center rounded-full ${ring}`}>
        <Icon name={icon} size={30} strokeWidth={1.9} />
      </span>
      <h2 className="mt-4 max-w-[26ch] text-[21px] font-semibold leading-snug text-ink">{title}</h2>
      {children && <div className="mt-2 max-w-[32ch] text-sm text-ink-2">{children}</div>}
    </div>
  );
}

function StationChip({ st, onChange }: { st: Station; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded border border-line bg-white px-3 py-2">
      <Icon name="station" size={18} className="text-forest" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{st.name}</div>
        <div className="id-tag text-xs text-muted">{st.id}</div>
      </div>
      {onChange && (
        <button type="button" onClick={onChange} className="btn btn-ghost btn-sm">
          Đổi trạm
        </button>
      )}
    </div>
  );
}

function QrFinder() {
  return (
    <div className="relative mx-auto mt-6 aspect-square w-48 rounded-lg bg-ink/90">
      {[
        'left-3 top-3 border-l-[3px] border-t-[3px]',
        'right-3 top-3 border-r-[3px] border-t-[3px]',
        'left-3 bottom-3 border-l-[3px] border-b-[3px]',
        'right-3 bottom-3 border-r-[3px] border-b-[3px]',
      ].map((c) => (
        <span key={c} className={`absolute h-8 w-8 rounded-[3px] border-lime ${c}`} />
      ))}
      <Icon name="qr" size={64} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-paper/35" strokeWidth={1.2} />
      <span className="scanline absolute left-6 right-6 top-[38%] h-0.5 bg-lime/80" />
    </div>
  );
}

function SlotArt() {
  return (
    <svg viewBox="0 0 220 120" className="mx-auto mt-5 h-auto w-56" aria-hidden>
      <rect x="10" y="10" width="200" height="100" rx="6" fill="rgb(var(--c-sunk))" stroke="rgb(var(--c-line-strong))" />
      <circle cx="130" cy="60" r="34" fill="rgb(var(--c-forest))" />
      <circle cx="130" cy="60" r="23" fill="rgb(var(--c-ink))" />
      <g className="svg-move">
        <rect x="26" y="49" width="74" height="22" rx="9" fill="#e9f2f5" stroke="#7e98a3" />
        <rect x="16" y="54" width="12" height="12" rx="2" fill="rgb(var(--c-forest))" />
      </g>
      <path d="M104 60 h10" stroke="rgb(var(--c-ink))" strokeWidth="2.5" markerEnd="url(#slot-ah)" />
      <defs>
        <marker id="slot-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="rgb(var(--c-ink))" />
        </marker>
      </defs>
    </svg>
  );
}

export function ReturnFlow() {
  const state = useAppState();
  const store = useStore();
  const t = useT();
  const { cfg, stationId, setStationId, run, flowStep, setFlowStep } = useAppDemo();
  const { rs } = run;
  const station = state.stations.find((s) => s.id === stationId) ?? state.stations[0];
  const userId = state.currentUserId;
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const scrollTop = useRef(0);

  // Derive the outcome screen from the station run while a bottle is being processed.
  let screen: Screen = (flowStep as Screen) ?? 'choose';
  if (flowStep === 'running') {
    switch (rs.phase) {
      case 'BLOCKED':
        screen = rs.blockedWhy === 'fault' ? 'fault' : 'full';
        break;
      case 'RETURNED':
        screen = 'returned';
        break;
      case 'ACCEPTED':
      case 'FLATTENING':
      case 'DROP_CONFIRMED':
        screen = 'processing';
        break;
      case 'POINTS_CREDITED':
        screen = 'stored';
        break;
      case 'FAULT':
        screen = 'fault';
        break;
      default:
        screen = 'inspecting';
    }
  }

  useEffect(() => {
    if (screen !== null) document.getElementById('app-scroll')?.scrollTo({ top: scrollTop.current });
  }, [screen]);

  const session = useMemo(() => {
    if (!sessionStart) return { accepted: 0, returned: 0, credited: 0, pending: 0 };
    let accepted = 0,
      returned = 0,
      credited = 0,
      pending = 0;
    for (const x of state.transactions) {
      if (x.userId !== userId || x.stationId !== station.id || x.ts < sessionStart) continue;
      if (x.status === 'accepted') {
        accepted++;
        if (x.sync === 'synced') credited += x.points;
        else pending += x.points;
      } else returned++;
    }
    return { accepted, returned, credited, pending };
  }, [state.transactions, sessionStart, userId, station.id]);

  const stations = sortedStations(state);
  const usable = (s: Station) => ['open', 'near_full', 'unknown'].includes(availability(state, s));
  const alternative = stations.find((s) => s.id !== station.id && usable(s));

  const go = (s: Screen | 'running') => {
    if (s !== 'running') run.reset();
    setFlowStep(s);
  };
  const exit = () => {
    run.reset();
    setFlowStep('choose');
    setSessionStart(null);
    location.hash = 'app';
  };
  const scan = () => {
    const pre = canAcceptNext(store.getState(), station);
    if (!pre.ok) {
      go(pre.why === 'fault' ? 'fault' : 'full');
      return;
    }
    setSessionStart((x) => x ?? Date.now() - 1);
    go('insert');
  };
  const insert = () => {
    setFlowStep('running');
    void run.run(station.id, userId, cfg);
  };

  const back = { onClick: exit, label: 'Thoát trả chai' };
  const tally =
    sessionStart && (session.accepted > 0 || session.returned > 0) ? (
      <div className="mb-4 flex items-center justify-between rounded-sm bg-sunk px-3 py-1.5 text-xs">
        <span className="text-ink-2">Phiên này</span>
        <span className="tnum font-semibold text-ink">
          {session.accepted} chai · +{session.credited + session.pending} điểm
        </span>
      </div>
    ) : null;

  switch (screen) {
    case 'choose': {
      const rec = usable(station) ? station : (stations.find(usable) ?? station);
      return (
        <AppScreen
          title="Trả chai"
          back={back}
          footer={
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!usable(rec)}
              onClick={() => {
                setStationId(rec.id);
                go('scan');
              }}
            >
              Dùng trạm {rec.id}
            </Button>
          }
        >
          <Progress screen="choose" />
          <Instruction icon="mapPin" title="Bạn đang đứng ở trạm nào?">
            Chọn trạm trước mặt bạn. Trạm gần nhất đang nhận chai được chọn sẵn.
          </Instruction>
          <ul className="mt-6 flex flex-col gap-2" aria-label="Trạm">
            {stations.map((s) => {
              const a = availability(state, s);
              const ok = usable(s);
              const sel = s.id === rec.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!ok}
                    aria-pressed={sel}
                    onClick={() => setStationId(s.id)}
                    className={`flex w-full items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${sel ? 'border-ink bg-white shadow-1' : 'border-line bg-panel'}`}
                  >
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${sel ? 'border-forest' : 'border-line-strong'}`}>{sel && <span className="h-2.5 w-2.5 rounded-full bg-forest" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{s.name}</span>
                      <span className="text-xs text-muted">
                        <span className="id-tag">{s.id}</span> · <span className="tnum">{DEMO_DISTANCE_M[s.id]} m</span>
                      </span>
                    </span>
                    <Badge tone={AVAIL[a].tone} icon={AVAIL[a].icon}>
                      {AVAIL[a].label}
                    </Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        </AppScreen>
      );
    }
    case 'scan':
      return (
        <AppScreen
          title="Trả chai"
          back={back}
          footer={
            <Button variant="primary" size="lg" icon="qr" className="w-full" onClick={scan}>
              Quét mã (mô phỏng)
            </Button>
          }
        >
          <Progress screen="scan" />
          <StationChip st={station} onChange={() => go('choose')} />
          <div className="mt-6">
            <Instruction icon="qr" title="Quét mã QR trên màn hình trạm">
              Mã nằm ở màn hình bên phải, ngang tầm mắt. Quét mã để trạm biết điểm thuộc về bạn.
            </Instruction>
          </div>
          <QrFinder />
        </AppScreen>
      );
    case 'insert':
      return (
        <AppScreen
          title={`Trả chai · ${station.id}`}
          back={back}
          footer={
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" className="w-full" onClick={insert}>
                Đã đặt chai vào khe
              </Button>
              {sessionStart && session.accepted + session.returned > 0 && (
                <Button variant="quiet" className="w-full" onClick={() => go('summary')}>
                  Kết thúc phiên
                </Button>
              )}
            </div>
          }
        >
          <Progress screen="insert" />
          {tally}
          <Instruction icon="bottle" title="Đặt một chai PET rỗng vào khe">
            Không cần rửa hay tháo nhãn. Đổ hết nước trước khi đặt.
          </Instruction>
          <SlotArt />
          <ul className="mx-auto mt-5 grid max-w-[30ch] gap-1.5 text-sm text-ink-2">
            {['Một chai mỗi lần', 'Chỉ chai PET: không lon, thủy tinh, HDPE', 'Rút tay ra; cửa sẽ tự đóng'].map((x) => (
              <li key={x} className="flex gap-2">
                <Icon name="check" size={16} className="mt-0.5 text-forest" strokeWidth={2.2} />
                {x}
              </li>
            ))}
          </ul>
        </AppScreen>
      );
    case 'inspecting': {
      const ins = rs.phase === 'INSPECTING' ? rs.inspection : null;
      const rows: [IconName, string, string | null][] = [
        ['camera', 'Camera', ins ? `${t.material[ins.material]} · ${ins.confidencePct} %` : null],
        ['barcode', 'Mã vạch', ins ? (ins.barcodeRecognized ? 'Có trong danh mục' : 'Không đọc được') : null],
        ['scale', 'Cân', ins ? `${ins.measuredG} g` : null],
      ];
      return (
        <AppScreen title={`Trả chai · ${station.id}`} footer={<Button size="lg" className="w-full" disabled loading>Đang kiểm tra</Button>}>
          <Progress screen="inspecting" />
          {tally}
          <Instruction icon="camera" title={rs.phase === 'BOTTLE_INSERTED' ? 'Đã nhận vật phẩm, cửa đang đóng' : 'Đang kiểm tra chai'}>
            Vui lòng chờ vài giây. Không cần thao tác.
          </Instruction>
          <ul className="mx-auto mt-6 flex max-w-[300px] flex-col divide-y divide-line rounded border border-line bg-white">
            {rows.map(([ic, k, v]) => (
              <li key={k} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Icon name={ic} size={18} className="text-ink-2" />
                <span className="flex-1 text-ink-2">{k}</span>
                {v ? <span className="rise tnum font-medium text-ink">{v}</span> : <Spinner size={14} />}
              </li>
            ))}
          </ul>
        </AppScreen>
      );
    }
    case 'processing': {
      const order = ['ACCEPTED', 'FLATTENING', 'DROP_CONFIRMED'];
      const at = order.indexOf(rs.phase as string);
      const items = ['Chai hợp lệ', 'Rulo cán dẹt chai', 'Xác nhận chai đã vào thùng'];
      return (
        <AppScreen title={`Trả chai · ${station.id}`} footer={<Button size="lg" className="w-full" disabled loading>Đang xử lý</Button>}>
          <Progress screen="processing" />
          {tally}
          <Instruction icon="rollers" tone="forest" title="Chai hợp lệ. Trạm đang cán dẹt chai.">
            Điểm sẽ được cộng ngay khi trạm xác nhận chai đã vào thùng.
          </Instruction>
          <ol className="mx-auto mt-6 flex max-w-[300px] flex-col gap-3">
            {items.map((x, i) => {
              const done = i < at || (i === at && rs.phase === 'DROP_CONFIRMED');
              const active = i === at && !done;
              return (
                <li key={x} className="flex items-center gap-3 text-sm">
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${done ? 'bg-forest text-white' : active ? 'border-2 border-forest text-forest' : 'border-2 border-line-strong'}`}>
                    {done ? <Icon name="check" size={14} strokeWidth={2.6} /> : active ? <Spinner size={12} /> : null}
                  </span>
                  <span className={done || active ? 'font-medium text-ink' : 'text-muted'}>{x}</span>
                </li>
              );
            })}
          </ol>
        </AppScreen>
      );
    }
    case 'stored': {
      const c = rs.credited;
      const pending = c?.sync === 'pending';
      return (
        <AppScreen
          title={`Trả chai · ${station.id}`}
          footer={
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" className="w-full" disabled={rs.running} onClick={() => go('insert')}>
                Trả thêm chai
              </Button>
              <Button variant="quiet" className="w-full" disabled={rs.running} onClick={() => go('summary')}>
                Xong
              </Button>
            </div>
          }
        >
          <Progress screen="stored" />
          <Instruction icon={pending ? 'clock' : 'checkCircle'} tone={pending ? 'slate' : 'forest'} title={pending ? 'Chai đã vào thùng.' : 'Chai đã vào thùng. Điểm đã được cộng.'}>
            {pending ? 'Giao dịch đang chờ đồng bộ.' : null}
          </Instruction>
          <div className={`rise mx-auto mt-5 max-w-[280px] rounded-lg border p-4 text-center ${pending ? 'border-dashed border-slate/60 bg-slate-tint' : 'border-forest/30 bg-lime-tint'}`}>
            <div className={`tnum text-4xl font-bold ${pending ? 'text-slate' : 'text-forest'}`}>+{c?.points ?? 0}</div>
            <div className="mt-0.5 text-sm font-medium text-ink-2">{pending ? 'điểm chờ đồng bộ' : 'điểm'}</div>
          </div>
          {pending && (
            <p className="mx-auto mt-3 max-w-[32ch] text-center text-xs text-slate">
              Trạm {station.id} đang mất kết nối. Chai đã được ghi tại trạm; điểm sẽ chuyển sang khả dụng khi trạm gửi dữ liệu về RE Hub.
            </p>
          )}
        </AppScreen>
      );
    }
    case 'returned': {
      const r = rs.inspection?.reason;
      const msg =
        r === 'unsupported_material'
          ? { title: 'Trạm hiện chỉ nhận chai PET.', body: 'Vui lòng lấy vật phẩm ra. Lon, chai thủy tinh và chai HDPE chưa được nhận trong giai đoạn thí điểm.', icon: 'bottle' as IconName }
          : r === 'excess_liquid'
            ? { title: 'Vui lòng đổ hết nước trước khi thử lại.', body: `Cân đọc được ${rs.inspection?.measuredG ?? ''} g, nặng hơn một chai rỗng. Lấy chai ra, đổ hết nước rồi đặt lại.`, icon: 'drop' as IconName }
            : { title: 'Chưa nhận diện được chai. Vui lòng lấy chai ra.', body: 'Xoay chai để nhãn và mã vạch hướng ra ngoài rồi thử lại, hoặc dùng chai khác.', icon: 'camera' as IconName };
      return (
        <AppScreen
          title={`Trả chai · ${station.id}`}
          footer={
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" className="w-full" disabled={rs.running} onClick={() => go('insert')}>
                Thử lại với chai khác
              </Button>
              <Button variant="quiet" className="w-full" disabled={rs.running} onClick={() => go('summary')}>
                Kết thúc phiên
              </Button>
            </div>
          }
        >
          <Progress screen="returned" />
          <Instruction icon={msg.icon} tone="amber" title={msg.title}>
            {msg.body}
          </Instruction>
          <div className="mx-auto mt-5 flex max-w-[300px] items-center gap-2 rounded border border-line bg-white px-3 py-2 text-xs text-ink-2">
            <Icon name="info" size={15} className="text-info" />
            Vật phẩm đã được trả ra khe. Lần này không tính điểm.
          </div>
        </AppScreen>
      );
    }
    case 'full':
      return (
        <AppScreen
          title="Trả chai"
          back={back}
          footer={
            <Button variant="primary" size="lg" className="w-full" onClick={() => (alternative ? (setStationId(alternative.id), go('scan')) : go('choose'))}>
              {alternative ? `Dùng trạm ${alternative.id} · ${DEMO_DISTANCE_M[alternative.id]} m` : 'Xem trạm khác'}
            </Button>
          }
        >
          <Progress screen="full" />
          <Instruction icon="stop" tone="fault" title="Trạm tạm ngừng nhận. Xem trạm khác.">
            Thùng chứa của {station.id} đã đạt mức dừng 95 %. RE Hub đã báo người vận hành rằng trạm cần thay thùng.
          </Instruction>
          {alternative && (
            <div className="mx-auto mt-6 max-w-[320px]">
              <div className="mb-1 text-xs font-medium text-muted">Trạm gần nhất đang nhận</div>
              <StationChip st={alternative} />
            </div>
          )}
        </AppScreen>
      );
    case 'fault':
      return (
        <AppScreen
          title={`Trả chai · ${station.id}`}
          back={back}
          footer={
            <Button variant="primary" size="lg" className="w-full" disabled={rs.running} onClick={() => go('choose')}>
              Xem trạm khác
            </Button>
          }
        >
          <Progress screen="fault" />
          <Instruction icon="stop" tone="fault" title="Trạm tạm dừng do sự cố.">
            Chai đang xử lý không được tính điểm. Đơn vị vận hành đã nhận cảnh báo trên RE Hub (mô phỏng). Vui lòng không mở cửa trạm.
          </Instruction>
        </AppScreen>
      );
    case 'summary':
      return (
        <AppScreen
          title="Phiên trả chai"
          footer={
            <div className="flex flex-col gap-2">
              <Button variant="primary" size="lg" className="w-full" onClick={exit}>
                Về trang chủ
              </Button>
              <a href="#app-history" className="btn btn-quiet w-full" onClick={() => (run.reset(), setFlowStep('choose'), setSessionStart(null))}>
                Xem lịch sử
              </a>
            </div>
          }
        >
          <Progress screen="summary" />
          <Instruction icon="checkCircle" tone="forest" title="Cảm ơn bạn. Phiên trả chai đã kết thúc." />
          <dl className="mx-auto mt-6 grid max-w-[300px] grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line text-center">
            {[
              ['Chai được nhận', n0(session.accepted)],
              ['Bị trả lại', n0(session.returned)],
              ['Điểm đã cộng', `+${n0(session.credited)}`],
              ['Chờ đồng bộ', `+${n0(session.pending)}`],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-2 py-3">
                <dt className="text-[11px] text-muted">{k}</dt>
                <dd className="tnum text-lg font-semibold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </AppScreen>
      );
  }
}
