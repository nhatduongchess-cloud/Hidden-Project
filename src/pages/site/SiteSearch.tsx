import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from '../../components/icons';
import { useAppState } from '../../lib/store-context';
import { ZONES } from '../../components/StationIllustration';
import { availability, AVAIL } from '../app/screens';
import { ZONE_INFO } from './zones';
import { KIND_LABEL, SCOPES, searchSite, siteEntries, type SearchEntry, type SearchScope } from './search';

/** Header search: a scope menu, a combobox with suggestions as you type, and a search button. */
export function SiteSearch() {
  const state = useAppState();
  const entries = useMemo(
    () => siteEntries(state.stations, ZONES.map((id) => ({ id, name: ZONE_INFO[id].name, summary: ZONE_INFO[id].summary }))),
    [state.stations],
  );
  const [scope, setScope] = useState<SearchScope>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const results = useMemo(() => searchSite(entries, query, scope), [entries, query, scope]);
  const showList = open && query.trim() !== '';

  const go = (e: SearchEntry | undefined) => {
    if (!e) return;
    setOpen(false);
    setActive(-1);
    input.current?.blur();
    location.hash = e.href.slice(1);
    window.scrollTo({ top: 0 });
  };

  const onKey = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      setOpen(true);
      if (!results.length) return;
      // -1 is "nothing highlighted", so the list cycles back to the typed text.
      const n = results.length;
      setActive((a) => (ev.key === 'ArrowDown' ? (a + 1 >= n ? -1 : a + 1) : a - 1 < -1 ? n - 1 : a - 1));
    } else if (ev.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  };

  const stationById = (href: string) => state.stations.find((s) => href === `#hub-station-${s.id}`);

  return (
    <form
      role="search"
      className="relative flex h-10 min-w-0 flex-1 rounded-md bg-white focus-within:ring-[3px] focus-within:ring-shop-cta-2"
      onSubmit={(ev) => {
        ev.preventDefault();
        go(results[active] ?? results[0]);
      }}
    >
      <select
        aria-label="Phạm vi tìm kiếm"
        value={scope}
        onChange={(e) => setScope(e.target.value as SearchScope)}
        className="max-w-[118px] shrink-0 cursor-pointer rounded-l-md border-r border-shop-line bg-[#E6E6E6] pl-2 pr-1 text-xs text-shop-text hover:bg-[#DADADA] focus:outline-none"
      >
        {SCOPES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        ref={input}
        role="combobox"
        aria-label="Tìm trên RE"
        aria-expanded={showList && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Tìm trạm, bộ phận trạm, trang…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
        className="min-w-0 flex-1 bg-transparent px-2.5 text-[15px] text-shop-text placeholder:text-[#6F7373] focus:outline-none"
      />
      <button type="submit" aria-label="Tìm kiếm" className="grid w-11 shrink-0 place-items-center rounded-r-md bg-shop-search text-shop-text hover:bg-shop-cta-2">
        <Icon name="search" size={20} strokeWidth={2.2} />
      </button>

      {showList &&
        (results.length ? (
          <ul id={listId} role="listbox" aria-label="Gợi ý tìm kiếm" className="absolute inset-x-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-md border border-shop-line bg-white py-1 text-shop-text shadow-2">
            {results.map((e, i) => {
              const st = e.kind === 'station' ? stationById(e.href) : undefined;
              const a = st ? AVAIL[availability(state, st)] : undefined;
              return (
                <li
                  key={e.href}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => go(e)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 ${i === active ? 'bg-[#F0F2F2]' : ''}`}
                >
                  <Icon name={e.kind === 'station' ? 'station' : e.kind === 'part' ? 'layers' : 'search'} size={16} className="shrink-0 text-[#6F7373]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{e.title}</span>
                    <span className="block truncate text-xs text-shop-muted">{a ? `${e.detail} · ${a.label}` : e.detail}</span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-shop-muted sm:inline">{KIND_LABEL[e.kind]}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p role="status" className="absolute inset-x-0 top-[calc(100%+4px)] z-30 rounded-md border border-shop-line bg-white px-3 py-2.5 text-sm text-shop-text shadow-2">
            Không tìm thấy kết quả cho “{query.trim()}”
          </p>
        ))}
    </form>
  );
}
