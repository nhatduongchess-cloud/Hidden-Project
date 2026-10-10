import { useMemo, useState } from 'react';
import { useAppState } from '../../lib/store-context';
import { userStats, userStationAvailability } from '../../domain/ops';
import { fillPct } from '../../domain/selectors';
import { DEMO_DISTANCE_M } from '../../domain/constants';
import type { AppState, Station, Transaction } from '../../domain/types';
import { Icon, type IconName } from '../../components/icons';
import { Badge, DemoTag, EmptyState, Segmented, type Tone } from '../../components/ui';
import { ago, n0, n1, dateTime } from '../../lib/format';
import { useT } from '../../i18n';
import { AppScreen } from './AppExperience';
import { useAppDemo } from './appContext';

/* ---------- shared bits ---------- */

export type Availability = 'open' | 'near_full' | 'stopped' | 'fault' | 'unknown';
export function availability(state: AppState, st: Station): Availability {
  const a = userStationAvailability(state, st);
  if (a === 'open' && fillPct(state, st, 'hub') >= state.settings.warnPct) return 'near_full';
  return a;
}
export const AVAIL: Record<Availability, { label: string; tone: Tone; icon: IconName }> = {
  open: { label: 'Đang nhận chai', tone: 'forest', icon: 'checkCircle' },
  near_full: { label: 'Gần đầy, vẫn nhận', tone: 'amber', icon: 'alert' },
  stopped: { label: 'Tạm ngừng nhận', tone: 'fault', icon: 'stop' },
  fault: { label: 'Tạm dừng do sự cố', tone: 'fault', icon: 'stop' },
  unknown: { label: 'Chưa rõ tình trạng', tone: 'slate', icon: 'wifiOff' },
};

export function sortedStations(state: AppState) {
  return [...state.stations].sort((a, b) => (DEMO_DISTANCE_M[a.id] ?? 999) - (DEMO_DISTANCE_M[b.id] ?? 999));
}

function TxRow({ t }: { t: Transaction }) {
  const tr = useT();
  const icon: IconName = t.status === 'accepted' ? (t.sync === 'pending' ? 'clock' : 'checkCircle') : t.status === 'rejected' ? 'arrowLeft' : 'stop';
  const ic = t.status === 'accepted' ? (t.sync === 'pending' ? 'text-slate' : 'text-forest') : 'text-fault-ink';
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sunk ${ic}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">
          {t.status === 'accepted' ? tr.material[t.material] : t.status === 'rejected' ? `Trả lại · ${tr.reason[t.reason ?? ''] ?? ''}` : 'Bị dừng, không tính điểm'}
        </div>
        <div className="text-xs text-muted">
          <span className="id-tag">{t.stationId}</span> · {dateTime(t.ts)}
        </div>
      </div>
      <div className="text-right">
        {t.status === 'accepted' ? (
          <>
            <div className={`tnum text-sm font-semibold ${t.sync === 'pending' ? 'text-slate' : 'text-forest'}`}>+{t.points}</div>
            {t.sync === 'pending' && <div className="text-[11px] font-medium text-slate">chờ đồng bộ</div>}
          </>
        ) : (
          <div className="tnum text-sm font-medium text-muted">0</div>
        )}
      </div>
    </li>
  );
}

/* ---------- Home ---------- */

export function HomeScreen() {
  const state = useAppState();
  const me = state.currentUserId;
  const s = useMemo(() => userStats(state, me, 4), [state, me]);
  const stations = sortedStations(state);
  return (
    <AppScreen>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted">Xin chào</div>
          <div className="id-tag truncate text-[15px] font-semibold text-ink">{me}</div>
        </div>
        <DemoTag />
      </div>

      {/* Points: the primary balance. Bottles and mass are separate, secondary measures. */}
      <section aria-label="Điểm thưởng" className="mt-4 rounded-lg bg-forest p-4 text-white shadow-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-white/75">Điểm khả dụng</div>
            <div className="tnum mt-1 text-[34px] font-bold leading-none tracking-tight">
              {n0(s.creditedPoints)}
              <span className="ml-1.5 text-base font-semibold text-white/80">điểm</span>
            </div>
          </div>
          <a href="#app-rewards" className="inline-flex min-h-[36px] items-center gap-1 rounded-sm bg-white/15 px-2.5 text-xs font-semibold text-white hover:bg-white/25">
            Đổi điểm <Icon name="chevronRight" size={14} />
          </a>
        </div>
        {s.pendingPoints > 0 && (
          <div className="mt-3 flex items-center gap-1.5 rounded-sm bg-white/12 px-2.5 py-1.5 text-xs font-medium">
            <Icon name="clock" size={14} />
            <span className="tnum">+{n0(s.pendingPoints)}</span> điểm đang chờ đồng bộ từ trạm
          </div>
        )}
      </section>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded border border-line bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="bottle" size={14} /> Chai đã trả
          </div>
          <div className="tnum mt-1 text-xl font-semibold text-ink">
            {n0(s.acceptedBottles)} <span className="text-sm font-medium text-muted">chai</span>
          </div>
        </div>
        <div className="rounded border border-line bg-white p-3">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Icon name="scale" size={14} /> Khối lượng PET
          </div>
          <div className="tnum mt-1 text-xl font-semibold text-ink">
            {n1(s.estimatedKg)} <span className="text-sm font-medium text-muted">kg</span>
          </div>
          <div className="text-[11px] text-muted">ước tính, 22 g/chai</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <a href="#app-return" className="btn btn-primary btn-lg w-full">
          <Icon name="bottle" size={20} /> Trả chai
        </a>
        <a href="#app-stations" className="btn btn-secondary w-full">
          <Icon name="mapPin" size={17} /> Tìm trạm gần bạn
        </a>
      </div>

      <section className="mt-6" aria-labelledby="near-h">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="near-h" className="text-[15px] font-semibold text-ink">
            Trạm gần bạn
          </h2>
          <a href="#app-stations" className="text-xs font-semibold text-forest">
            Xem bản đồ
          </a>
        </div>
        <ul className="divide-y divide-line rounded border border-line bg-white">
          {stations.map((st) => {
            const a = availability(state, st);
            return (
              <li key={st.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{st.name}</div>
                  <div className="text-xs text-muted">
                    <span className="id-tag">{st.id}</span> · <span className="tnum">{DEMO_DISTANCE_M[st.id] ?? '–'} m</span>
                  </div>
                </div>
                <Badge tone={AVAIL[a].tone} icon={AVAIL[a].icon}>
                  {AVAIL[a].label}
                </Badge>
              </li>
            );
          })}
        </ul>
        <p className="mt-1.5 text-[11px] text-muted">Khoảng cách minh họa.</p>
      </section>

      <section className="mt-5" aria-labelledby="recent-h">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 id="recent-h" className="text-[15px] font-semibold text-ink">
            Lần trả gần đây
          </h2>
          <a href="#app-history" className="text-xs font-semibold text-forest">
            Tất cả
          </a>
        </div>
        {s.recent.length ? (
          <ul className="divide-y divide-line rounded border border-line bg-white px-3">
            {s.recent.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="bottle" title="Chưa có lần trả nào">
            Chai đầu tiên của bạn sẽ hiện ở đây.
          </EmptyState>
        )}
      </section>
    </AppScreen>
  );
}

/* ---------- Find a station ---------- */

export function StationsScreen() {
  const state = useAppState();
  const { setStationId, setFlowStep } = useAppDemo();
  const stations = sortedStations(state);
  const [sel, setSel] = useState(stations[0]?.id);
  const pick = (id: string) => {
    setStationId(id);
    setFlowStep('scan');
    location.hash = 'app-return';
  };
  return (
    <AppScreen title="Tìm trạm gần bạn" back={{ href: '#app', label: 'Về trang chủ' }}>
      <div className="relative aspect-[4/3] overflow-hidden rounded border border-line bg-[rgb(234_232_224)]" role="img" aria-label="Sơ đồ khuôn viên minh họa với vị trí của bạn và ba trạm">
        <svg viewBox="0 0 100 75" className="absolute inset-0 h-full w-full" aria-hidden>
          <path d="M0 50 C 25 46, 40 58, 100 40" stroke="#fff" strokeWidth="5" fill="none" />
          <path d="M55 0 L 48 75" stroke="#fff" strokeWidth="4" fill="none" />
          <rect x="8" y="10" width="26" height="16" rx="1" fill="rgb(221 218 208)" />
          <rect x="62" y="6" width="24" height="18" rx="1" fill="rgb(221 218 208)" />
          <rect x="30" y="56" width="22" height="14" rx="1" fill="rgb(221 218 208)" />
          <circle cx="40" cy="44" r="5" fill="rgb(var(--c-info) / 0.15)" />
          <circle cx="40" cy="44" r="1.8" fill="rgb(var(--c-info))" stroke="#fff" strokeWidth="0.8" />
        </svg>
        {stations.map((st) => {
          const a = availability(state, st);
          const x = st.mapX;
          const y = st.mapY * 0.75 + 4;
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => setSel(st.id)}
              aria-label={`${st.id}, ${st.name}: ${AVAIL[a].label}`}
              aria-pressed={sel === st.id}
              className={`absolute -translate-x-1/2 -translate-y-full rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold shadow-1 ${
                sel === st.id ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-white text-ink'
              }`}
              style={{ left: `${x}%`, top: `${(y / 75) * 100}%` }}
            >
              <span className="inline-flex items-center gap-1">
                <Icon name={AVAIL[a].icon} size={12} className={sel === st.id ? '' : a === 'open' ? 'text-forest' : a === 'unknown' ? 'text-slate' : a === 'near_full' ? 'text-amber-ink' : 'text-fault-ink'} strokeWidth={2.2} />
                <span className="id-tag">{st.id}</span>
              </span>
            </button>
          );
        })}
        <span className="absolute bottom-1.5 left-2 text-[10.5px] font-medium text-muted">Sơ đồ minh họa · chấm xanh là bạn</span>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {stations.map((st) => {
          const a = availability(state, st);
          const usable = a === 'open' || a === 'near_full' || a === 'unknown';
          return (
            <li key={st.id} className={`rounded border bg-white p-3 ${sel === st.id ? 'border-ink' : 'border-line'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-ink">{st.name}</div>
                  <div className="text-xs text-muted">
                    <span className="id-tag">{st.id}</span> · {st.site} · <span className="tnum">{DEMO_DISTANCE_M[st.id] ?? '–'} m</span>
                  </div>
                </div>
                <Badge tone={AVAIL[a].tone} icon={AVAIL[a].icon}>
                  {AVAIL[a].label}
                </Badge>
              </div>
              {a === 'unknown' && <p className="mt-2 text-xs text-slate">Trạm chưa gửi dữ liệu từ {ago(st.lastUpdate)}. Bạn vẫn có thể thử; giao dịch sẽ được đồng bộ sau.</p>}
              {a === 'stopped' && <p className="mt-2 text-xs text-fault-ink">Thùng đã đầy. Đội thu gom sẽ thay thùng; hãy dùng trạm khác.</p>}
              {a === 'fault' && <p className="mt-2 text-xs text-fault-ink">Trạm đang chờ kỹ thuật viên kiểm tra.</p>}
              {usable && (
                <button type="button" className="btn btn-secondary btn-sm mt-3 w-full" onClick={() => pick(st.id)}>
                  Trả chai tại đây
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </AppScreen>
  );
}

/* ---------- History ---------- */

export function HistoryScreen() {
  const state = useAppState();
  const s = useMemo(() => userStats(state, state.currentUserId, 2000), [state]);
  const [f, setF] = useState<'all' | 'accepted' | 'returned' | 'pending'>('all');
  const rows = s.recent.filter((t) => (f === 'all' ? true : f === 'accepted' ? t.status === 'accepted' : f === 'returned' ? t.status !== 'accepted' : t.sync === 'pending'));
  const groups = new Map<string, Transaction[]>();
  for (const t of rows.slice(0, 120)) {
    const d = new Date(t.ts);
    const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  return (
    <AppScreen title="Lịch sử trả chai" back={{ href: '#app', label: 'Về trang chủ' }}>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Chai được nhận', n0(s.acceptedBottles)],
          ['Bị trả lại', n0(s.returnedItems)],
          ['Kg ước tính', n1(s.estimatedKg)],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-line bg-white px-2 py-2">
            <div className="tnum text-lg font-semibold text-ink">{v}</div>
            <div className="text-[11px] text-muted">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Segmented
          label="Lọc lịch sử"
          hideLabel
          name="hist-f"
          size="sm"
          value={f}
          onChange={setF}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'accepted', label: 'Đã nhận' },
            { value: 'returned', label: 'Trả lại' },
            { value: 'pending', label: 'Chờ đồng bộ' },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon="history" title="Không có mục nào">
            {f === 'pending' ? 'Mọi giao dịch của bạn đã được đồng bộ.' : 'Thử bộ lọc khác.'}
          </EmptyState>
        </div>
      ) : (
        [...groups.entries()].map(([day, list]) => (
          <section key={day} className="mt-4">
            <h2 className="tnum text-xs font-semibold text-muted">{day}</h2>
            <ul className="mt-1 divide-y divide-line rounded border border-line bg-white px-3">
              {list.map((t) => (
                <TxRow key={t.id} t={t} />
              ))}
            </ul>
          </section>
        ))
      )}
    </AppScreen>
  );
}

/* ---------- Rewards ---------- */

export function RewardsScreen() {
  const state = useAppState();
  const s = useMemo(() => userStats(state, state.currentUserId, 8), [state]);
  return (
    <AppScreen title="Điểm thưởng" back={{ href: '#app', label: 'Về trang chủ' }}>
      <div className="rounded-lg border border-line bg-white p-4">
        <div className="text-xs text-muted">Điểm khả dụng</div>
        <div className="tnum mt-1 text-3xl font-bold text-forest">
          {n0(s.creditedPoints)} <span className="text-base font-semibold text-muted">điểm</span>
        </div>
        {s.pendingPoints > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate">
            <Icon name="clock" size={14} /> <span className="tnum">+{n0(s.pendingPoints)}</span> điểm chờ đồng bộ, chưa dùng được
          </div>
        )}
        <dl className="mt-4 grid gap-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Mỗi chai được nhận</dt>
            <dd className="tnum font-medium">{state.settings.pointsPerBottle} điểm</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Chai bị trả lại</dt>
            <dd className="font-medium">0 điểm</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Giá trị quy đổi</dt>
            <dd className="font-medium">Chưa có</dd>
          </div>
        </dl>
      </div>

      <section className="mt-5" aria-labelledby="rw-h">
        <h2 id="rw-h" className="mb-2 text-[15px] font-semibold text-ink">
          Đổi điểm
        </h2>
        <EmptyState icon="gift" title="Chưa có ưu đãi để đổi">
          Trong thí điểm, ưu đãi chỉ có khi nhà tài trợ trạm hoặc chủ địa điểm tham gia. Hiện chưa có đối tác nào, nên điểm chưa có giá trị quy đổi.
        </EmptyState>
      </section>

      <section className="mt-5" aria-labelledby="ledger-h">
        <h2 id="ledger-h" className="mb-1 text-[15px] font-semibold text-ink">
          Biến động điểm gần đây
        </h2>
        {s.recent.length ? (
          <ul className="divide-y divide-line rounded border border-line bg-white px-3">
            {s.recent.map((t) => (
              <TxRow key={t.id} t={t} />
            ))}
          </ul>
        ) : (
          <EmptyState icon="history" title="Chưa có biến động" />
        )}
      </section>
    </AppScreen>
  );
}
