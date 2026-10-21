import { useState } from 'react';
import { useAppState } from '../../lib/store-context';
import { allStationOps } from '../../domain/ops';
import { RoadMap, type MapMarker } from '../../components/LazyRoadMap';
import { AreaSelect } from '../../components/AreaSelect';
import { Badge, SearchField, SelectField } from '../../components/ui';
import { Icon } from '../../components/icons';
import { n0 } from '../../lib/format';

export function NetworkMap() {
  const state = useAppState();
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [selected, setSelected] = useState<string | null>(null);
  const normalize = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .toLowerCase();
  const ops = allStationOps(state).filter(
    (o) =>
      normalize(`${o.station.id} ${o.station.name}`).includes(normalize(query)) &&
      (status === 'all' || (status === 'collect' ? o.hubFillPct >= state.settings.warnPct : o.stale)),
  );
  const pick = ops.find((o) => o.station.id === selected);
  const markers: MapMarker[] = ops.map((o) => ({
    id: o.station.id,
    kind: 'station',
    lat: o.station.lat,
    lng: o.station.lng,
    label: `${o.station.id} · ${n0(o.hubFillPct)}%`,
    title: `${o.station.id} · ${o.station.name} · ${n0(o.hubFillPct)}%${o.stale ? ' · dữ liệu cũ' : ''}`,
    tone: o.op === 'stopped' || o.station.fault ? 'fault' : o.stale ? 'slate' : o.hubFillPct >= state.settings.warnPct ? 'amber' : 'forest',
    selected: o.station.id === selected,
  }));
  return (
    <div>
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <AreaSelect id="overview-area" />
        <SelectField
          id="network-status"
          label="Trạng thái trạm"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Tất cả trạm' },
            { value: 'collect', label: `Cần thu gom ≥ ${state.settings.warnPct}%` },
            { value: 'stale', label: 'Dữ liệu cũ / mất kết nối' },
          ]}
        />
        <div className="sm:col-span-2">
          <SearchField
            id="network-search"
            label="Tìm trạm trên bản đồ"
            placeholder="Tìm mã hoặc tên trạm…"
            value={query}
            onChange={setQuery}
          />
        </div>
      </div>
      <RoadMap
        markers={markers}
        fitPoints={pick ? [pick.station] : ops.map((o) => o.station)}
        fitKey={`${state.settings.areaId}:${status}:${query}:${selected}`}
        onMarkerClick={setSelected}
        label="Bản đồ trạm thu gom"
        className="h-[340px] sm:h-[380px]"
      />
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-line px-4 py-3 text-[11px] text-muted">
        <span>
          <i className="ops-dot bg-forest" />
          Đang nhận
        </span>
        <span>
          <i className="ops-dot bg-amber" />
          Cần thu gom
        </span>
        <span>
          <i className="ops-dot bg-fault" />
          Dừng / lỗi
        </span>
        <span>
          <i className="ops-dot bg-slate" />
          Dữ liệu cũ
        </span>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-3">
        {ops.map((o) => (
          <button
            key={o.station.id}
            className={`ops-station-card ${selected === o.station.id ? 'is-selected' : ''}`}
            onClick={() => setSelected(o.station.id)}
            aria-pressed={selected === o.station.id}
          >
            <span className="flex justify-between gap-1">
              <strong className="id-tag">{o.station.id}</strong>
              <span className={o.hubFillPct >= state.settings.stopPct ? 'text-fault-ink' : 'text-forest'}>{n0(o.hubFillPct)}%</span>
            </span>
            <span className="mt-1 block truncate text-xs text-muted">{o.station.name}</span>
            <span className="ops-fill-track">
              <span
                className={
                  o.hubFillPct >= state.settings.stopPct ? 'bg-fault' : o.hubFillPct >= state.settings.warnPct ? 'bg-amber' : 'bg-forest'
                }
                style={{ width: `${Math.min(100, o.hubFillPct)}%` }}
              />
            </span>
            <span className="mt-1 block text-[10px] text-muted">
              {o.stale ? 'Dữ liệu cũ' : o.op === 'stopped' ? 'Đã dừng nhận chai' : o.station.fault ? 'Cần xử lý lỗi' : 'Đã đồng bộ'}
            </span>
          </button>
        ))}
      </div>
      {ops.length === 0 && (
        <p role="status" className="p-4 text-sm text-muted">
          Không có trạm phù hợp. Hãy thay từ khóa hoặc trạng thái.
        </p>
      )}
      {pick && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <div>
            <strong className="text-sm">{pick.station.name}</strong>
            <div className="text-xs text-muted">
              {pick.station.id} · Mở cửa {pick.station.accessWindow.start}–{pick.station.accessWindow.end}
            </div>
          </div>
          <a href={`#hub-station-${pick.station.id}`} className="btn btn-secondary btn-sm">
            Xem chi tiết
            <Icon name="arrowRight" size={14} />
          </a>
        </div>
      )}
      <p className="px-4 pb-3 text-[11px] text-muted">
        <Badge tone="slate">Vị trí minh họa</Badge> Bản đồ nền OpenStreetMap. Chọn trạm để xem mức đầy và trạng thái.
      </p>
    </div>
  );
}
