import { useAppState } from '../../lib/store-context';
import { fillPct } from '../../domain/selectors';
import type { Phase } from '../../domain/deposit';
import { StationIllustration } from '../../components/StationIllustration';
import { Badge, DemoTag, FillMeter } from '../../components/ui';
import { Icon } from '../../components/icons';
import { useAppDemo, type LiveEvent } from './appContext';

const SCREEN: Partial<Record<Phase, string>> = {
  BOTTLE_INSERTED: 'Đặt chai vào khe',
  DOOR_CLOSED: 'Đang đóng cửa',
  INSPECTING: 'Đang kiểm tra',
  RETURNED: 'Vui lòng lấy chai ra',
  ACCEPTED: 'Chai hợp lệ',
  FLATTENING: 'Đang xử lý',
  DROP_CONFIRMED: 'Đã nhận chai',
  BLOCKED: 'Tạm ngừng nhận',
  FAULT: 'Trạm tạm dừng',
};

const TONE_DOT: Record<LiveEvent['tone'], string> = {
  info: 'bg-line-strong',
  ok: 'bg-forest',
  warn: 'bg-amber',
  stop: 'bg-fault',
};

const time = (ts: number) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** The physical station as the demo simulates it: what the hardware is doing, not what RE Hub knows. */
export function LiveStation({ compact }: { compact?: boolean }) {
  const state = useAppState();
  const { stationId, run } = useAppDemo();
  const { rs } = run;
  const station = state.stations.find((s) => s.id === stationId) ?? state.stations[0];
  const { warnPct, stopPct } = state.settings;
  const fill = fillPct(state, station, 'station');
  const phase: Phase = rs.phase === 'IDLE' ? 'READY' : rs.phase;
  const full = fill >= stopPct;
  const idleText = station.fault ? 'Trạm tạm dừng' : full ? 'Tạm ngừng nhận' : 'Quét mã QR';
  const screenText = phase === 'READY' ? idleText : phase === 'POINTS_CREDITED' ? `+${rs.credited?.points ?? 0} điểm` : (SCREEN[phase] ?? idleText);
  const rejected = rs.inspection?.decision === 'return';

  const illo = (
    <StationIllustration
      view="cutaway"
      compact
      phase={phase}
      fillPct={fill}
      warnPct={warnPct}
      stopPct={stopPct}
      fault={station.fault}
      rejected={rejected}
      pointsShown={phase === 'POINTS_CREDITED' ? (rs.credited?.points ?? null) : null}
      screenText={screenText}
      title={`Mặt cắt trạm ${station.id}. Màn hình: ${screenText}. Mức đầy ${Math.round(fill)} %.`}
    />
  );

  const events = rs.events.slice(0, compact ? 5 : 9);
  const log = (
    <div className="min-w-0">
      <div className="mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-muted">Nhật ký trạm</div>
      {events.length === 0 ? (
        <p className="text-xs text-muted">Chưa có sự kiện. Bắt đầu trả chai trong ứng dụng.</p>
      ) : (
        <ol className="flex flex-col gap-1" aria-live="polite" aria-label="Nhật ký sự kiện trạm">
          {events.map((e, i) => (
            <li key={e.ts + e.text + i} className={`flex items-start gap-2 text-xs ${i === 0 ? 'text-ink' : 'text-ink-2'}`}>
              <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[e.tone]}`} aria-hidden />
              <span className="tnum shrink-0 text-muted">{time(e.ts)}</span>
              <span className="min-w-0">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );

  return (
    <section className="rounded-lg border border-line bg-panel p-4" aria-label={`Trạm ${station.id} (mô phỏng)`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Icon name="station" size={16} className="text-forest" />
            <span className="id-tag">{station.id}</span>
            <span className="truncate font-medium text-ink-2">· {station.name}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {station.fault ? (
              <Badge tone="fault" icon="stop">
                {station.fault === 'jam' ? 'Kẹt rulo' : 'Dừng khẩn cấp'}
              </Badge>
            ) : full ? (
              <Badge tone="fault" icon="stop">
                Đã dừng nhận
              </Badge>
            ) : fill >= warnPct ? (
              <Badge tone="amber" icon="alert">
                Gần đầy
              </Badge>
            ) : (
              <Badge tone="forest" icon="checkCircle">
                Sẵn sàng
              </Badge>
            )}
            {station.connection === 'online' ? (
              <Badge icon="wifi">Trực tuyến</Badge>
            ) : (
              <Badge tone="slate" icon="wifiOff">
                Mất kết nối
              </Badge>
            )}
          </div>
        </div>
        <DemoTag>Mô phỏng</DemoTag>
      </div>
      {compact ? (
        <div className="grid grid-cols-[96px_1fr] gap-4">
          <div>{illo}</div>
          {log}
        </div>
      ) : (
        <>
          <div className="mx-auto max-w-[210px]">{illo}</div>
          <div className="mt-3">
            <FillMeter pct={fill} warn={warnPct} stop={stopPct} label={`Mức đầy ${station.id} tại trạm`} />
            <p className="mt-1 text-[11px] text-muted">Mức đầy do trạm tự đo. RE Hub chỉ thấy số đã đồng bộ.</p>
          </div>
          <div className="mt-4 border-t border-line pt-3">{log}</div>
        </>
      )}
    </section>
  );
}
