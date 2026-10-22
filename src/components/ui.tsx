import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon, type IconName } from './icons';
import type { OpStatus } from '../domain/ops';

/* ---------------------------------------------------------------------------
   RE component library. Every status combines an icon, a label and (where it
   applies) a number, so no state is communicated by colour alone.
--------------------------------------------------------------------------- */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
// Literal class names so Tailwind keeps every variant in the build.
const BTN_VARIANT: Record<BtnVariant, string> = { primary: 'btn-primary', secondary: 'btn-secondary', ghost: 'btn-ghost', danger: 'btn-danger', quiet: 'btn-quiet' };
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  loading,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: IconName; iconRight?: IconName; loading?: boolean }) {
  const sz = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <button type="button" className={`btn ${BTN_VARIANT[variant]} ${sz} ${className}`} aria-busy={loading || undefined} disabled={rest.disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={size === 'lg' ? 20 : 17} /> : null}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'lg' ? 20 : 17} />}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0 animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export type Tone = 'neutral' | 'forest' | 'lime' | 'amber' | 'fault' | 'slate' | 'info';
const TONE_CHIP: Record<Tone, string> = {
  neutral: 'bg-sunk text-ink-2',
  forest: 'bg-forest-tint text-forest-ink',
  lime: 'bg-lime-tint text-forest-ink',
  amber: 'bg-amber-tint text-amber-ink',
  fault: 'bg-fault-tint text-fault-ink',
  slate: 'bg-slate-tint text-slate',
  info: 'bg-[rgb(228_236_245)] text-info',
};
export function Badge({ tone = 'neutral', icon, children, className = '' }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={`chip ${TONE_CHIP[tone]} ${className}`}>
      {icon && <Icon name={icon} size={13} strokeWidth={2.1} />}
      {children}
    </span>
  );
}

export const OP_META: Record<OpStatus, { label: string; short: string; tone: Tone; icon: IconName }> = {
  accepting: { label: 'Đang nhận chai', short: 'Đang nhận', tone: 'forest', icon: 'checkCircle' },
  warning: { label: 'Cần thu gom (≥ 80 %)', short: 'Cần thu gom', tone: 'amber', icon: 'alert' },
  stopped: { label: 'Đã dừng nhận (≥ 95 %)', short: 'Đã dừng nhận', tone: 'fault', icon: 'stop' },
  jam: { label: 'Lỗi: kẹt rulo', short: 'Kẹt rulo', tone: 'fault', icon: 'stop' },
  estop: { label: 'Dừng khẩn cấp', short: 'Dừng khẩn cấp', tone: 'fault', icon: 'stop' },
};

/** Operational status. When the reading is stale, the label says it is the last known state. */
export function OpBadge({ op, stale, short }: { op: OpStatus; stale?: boolean; short?: boolean }) {
  const m = OP_META[op];
  return (
    <Badge tone={stale ? 'slate' : m.tone} icon={m.icon}>
      {short ? m.short : m.label}
      {stale && <span className="font-medium">· lần cuối</span>}
    </Badge>
  );
}

export function ConnBadge({ online, minutes }: { online: boolean; minutes?: number }) {
  return online ? (
    <Badge tone="neutral" icon="wifi">
      Trực tuyến
    </Badge>
  ) : (
    <Badge tone="slate" icon="wifiOff">
      Mất kết nối{minutes !== undefined ? ` · ${Math.round(minutes)} phút` : ''}
    </Badge>
  );
}

export function StaleTag({ children = 'Số đo cũ' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-dashed border-slate/60 px-1.5 py-px text-[11px] font-semibold text-slate">
      <Icon name="clock" size={12} strokeWidth={2.2} />
      {children}
    </span>
  );
}

/** Horizontal fill meter with 80 % and 95 % ticks. Stale readings are hatched and slate. */
export function FillMeter({
  pct,
  warn = 80,
  stop = 95,
  stale,
  label = 'Mức đầy',
  showValue = true,
  size = 'md',
}: {
  pct: number;
  warn?: number;
  stop?: number;
  stale?: boolean;
  label?: string;
  showValue?: boolean;
  size?: 'sm' | 'md';
}) {
  const p = Math.max(0, Math.min(100, pct));
  const color = stale ? 'bg-slate/70 hatch' : p >= stop ? 'bg-fault' : p >= warn ? 'bg-amber' : 'bg-forest';
  return (
    <div className="flex w-full min-w-0 items-center gap-2.5">
      <div
        className={`relative flex-1 overflow-hidden rounded-sm bg-sunk ${size === 'sm' ? 'h-2' : 'h-2.5'}`}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p)}
        aria-label={`${label}${stale ? ' (số đo cũ)' : ''}`}
      >
        <div className={`h-full ${color} transition-[width] duration-500`} style={{ width: `${p}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-amber-ink/70" style={{ left: `${warn}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-fault-ink/80" style={{ left: `${stop}%` }} />
      </div>
      {showValue && (
        <span className={`tnum w-11 shrink-0 text-right text-sm font-semibold ${stale ? 'text-slate' : 'text-ink'}`}>{Math.round(p)} %</span>
      )}
    </div>
  );
}

export function Metric({
  label,
  value,
  unit,
  sub,
  icon,
  tone,
  size = 'md',
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  icon?: IconName;
  tone?: 'amber' | 'fault' | 'slate' | 'forest';
  size?: 'sm' | 'md' | 'lg';
}) {
  const toneCls = tone === 'amber' ? 'text-amber-ink' : tone === 'fault' ? 'text-fault-ink' : tone === 'slate' ? 'text-slate' : tone === 'forest' ? 'text-forest' : 'text-ink';
  const vs = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-lg' : 'text-2xl';
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
        {icon && <Icon name={icon} size={14} />}
        {label}
      </div>
      <div className={`tnum font-semibold leading-none tracking-tight ${vs} ${toneCls}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-medium tracking-normal text-muted">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

type AlertTone = 'info' | 'warn' | 'stop' | 'stale' | 'success';
const ALERT: Record<AlertTone, { box: string; icon: IconName; ic: string }> = {
  info: { box: 'border-line bg-panel', icon: 'info', ic: 'text-info' },
  warn: { box: 'border-amber/50 bg-amber-tint', icon: 'alert', ic: 'text-amber-ink' },
  stop: { box: 'border-fault/40 bg-fault-tint', icon: 'stop', ic: 'text-fault-ink' },
  stale: { box: 'border-slate/40 bg-slate-tint', icon: 'wifiOff', ic: 'text-slate' },
  success: { box: 'border-forest/30 bg-forest-tint', icon: 'checkCircle', ic: 'text-forest' },
};
export function Alert({
  tone = 'info',
  title,
  children,
  actions,
  icon,
  className = '',
  live,
}: {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  className?: string;
  live?: boolean;
}) {
  const a = ALERT[tone];
  return (
    <div className={`flex gap-3 rounded border px-3.5 py-3 ${a.box} ${className}`} role={live ? (tone === 'stop' ? 'alert' : 'status') : undefined}>
      <Icon name={icon ?? a.icon} size={19} className={`mt-px ${a.ic}`} strokeWidth={2} />
      <div className="min-w-0 flex-1 text-sm">
        {title && <div className="font-semibold text-ink">{title}</div>}
        {children && <div className={`text-ink-2 ${title ? 'mt-0.5' : ''}`}>{children}</div>}
        {actions && <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = 'info', title, children, action }: { icon?: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded border border-dashed border-line-strong px-5 py-8 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full bg-sunk text-muted">
        <Icon name={icon} size={20} />
      </span>
      <div className="font-semibold text-ink">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function DemoTag({ children = 'Dữ liệu mẫu' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-line bg-sunk px-2 py-0.5 text-xs font-medium text-muted">
      {children}
    </span>
  );
}

export function EstimateTag({ children = 'Ước tính' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-sunk px-1.5 py-px text-[11px] font-semibold text-ink-2">
      <Icon name="sparkle" size={11} strokeWidth={2.2} />
      {children}
    </span>
  );
}

export function SectionHead({ eyebrow, title, children, as = 'h2' }: { eyebrow?: string; title: string; children?: ReactNode; as?: 'h2' | 'h3' }) {
  const H = as;
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <H className={`font-semibold text-ink ${as === 'h2' ? 'text-lg' : 'text-base'}`}>{title}</H>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
  unit,
  error,
  disabled,
  hideLabel,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  unit?: string;
  error?: string;
  disabled?: boolean;
  /** Keep the label for assistive tech only, e.g. inside a table with column headers. */
  hideLabel?: boolean;
}) {
  const [text, setText] = useState(String(value));
  const [bad, setBad] = useState<string | null>(null);
  useEffect(() => setText(String(value)), [value]);
  const hintId = useId();
  const errId = useId();
  const msg = error ?? bad;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
        {unit && <span className="ml-1 font-normal text-muted">({unit})</span>}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className={`input tnum ${msg ? 'input-error' : ''}`}
        value={text}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-invalid={msg ? true : undefined}
        aria-describedby={[hint ? hintId : '', msg ? errId : ''].join(' ').trim() || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value === '' || !Number.isFinite(v)) {
            setBad('Nhập một số.');
            return;
          }
          if ((min !== undefined && v < min) || (max !== undefined && v > max)) {
            setBad(`Giá trị từ ${min ?? '–'} đến ${max ?? '–'}.`);
            return;
          }
          setBad(null);
          onChange(v);
        }}
        onBlur={() => {
          setText(String(value));
          setBad(null);
        }}
      />
      {msg ? (
        <p id={errId} className="mt-1 flex items-center gap-1 text-xs font-medium text-fault-ink">
          <Icon name="alert" size={13} /> {msg}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="mt-1 text-xs text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({ id, label, value, onChange, placeholder, hint, type = 'text' }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; type?: string }) {
  const hintId = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} type={type} className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? hintId : undefined} />
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SearchField({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input id={id} type="search" className="input pl-9" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  onChange,
  options,
  hideLabel,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  hideLabel?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'field-label'}>
        {label}
      </label>
      <div className="relative">
        <select id={id} className="input appearance-none pr-9" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  name,
  hideLabel,
  size = 'md',
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  name: string;
  hideLabel?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <fieldset className="min-w-0">
      <legend className={hideLabel ? 'sr-only' : 'field-label'}>{label}</legend>
      <div className="inline-flex max-w-full flex-wrap rounded border border-line-strong bg-white p-0.5">
        {options.map((o) => (
          <label
            key={o.value}
            className={`relative inline-flex cursor-pointer items-center rounded-sm font-medium transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-forest ${
              size === 'sm' ? 'min-h-[30px] px-2.5 text-xs' : 'min-h-[36px] px-3 text-sm'
            } ${value === o.value ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-sunk'}`}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Switch({ id, label, checked, onChange, hint, disabled }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer text-sm">
        <span className="font-medium text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-forest' : 'bg-field'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-1 transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="flex max-w-full gap-1 overflow-x-auto border-b border-line scroll-thin">
      {items.map((it, i) => (
        <button
          key={it.value}
          ref={(el) => (refs.current[i] = el)}
          role="tab"
          type="button"
          aria-selected={value === it.value}
          tabIndex={value === it.value ? 0 : -1}
          onClick={() => onChange(it.value)}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            e.preventDefault();
            const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
            onChange(items[n].value);
            refs.current[n]?.focus();
          }}
          className={`-mb-px inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors ${
            value === it.value ? 'border-forest text-ink' : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          {it.label}
          {it.count !== undefined && <span className="tnum rounded-full bg-sunk px-1.5 text-[11px] font-semibold text-ink-2">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Disclosure({ summary, children, defaultOpen, className = '' }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details className={`group rounded border border-line bg-panel ${className}`} open={defaultOpen}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-3.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <Icon name="chevronRight" size={16} className="text-muted transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="px-3.5 pb-3.5">{children}</div>
    </details>
  );
}

/* ---------- Overlays ---------- */

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [open, onClose]);
}

function useFocusTrap(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const focusables = () =>
      Array.from(el?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])') ?? []);
    (focusables()[0] ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open]);
  return ref;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = 480,
  side = 'right',
  headerClassName = 'border-b border-line bg-panel',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  side?: 'left' | 'right';
  headerClassName?: string;
}) {
  useEscape(open, onClose);
  const ref = useFocusTrap(open);
  const titleId = useId();
  if (!open) return null;
  // Rendered at the page root: a fixed parent (the navigation screen) would otherwise trap it below
  // that screen's sheet and the top bar.
  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${side === 'left' ? 'justify-start' : 'justify-end'}`}>
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`${side === 'left' ? 'drawer-in-left' : 'drawer-in'} relative flex h-full w-full flex-col bg-paper shadow-3`}
        style={{ maxWidth: width, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className={`flex items-center justify-between gap-3 px-5 py-3 ${headerClassName}`}>
          <h2 id={titleId} className="min-w-0 text-base font-semibold">
            {title}
          </h2>
          <button type="button" className="btn btn-quiet btn-sm -mr-2" onClick={onClose} aria-label="Đóng">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-panel px-5 py-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function Dialog({ open, onClose, title, children, footer, tone }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; tone?: 'stop' }) {
  useEscape(open, onClose);
  const ref = useFocusTrap(open);
  const titleId = useId();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="sheet-in relative w-full max-w-md rounded-t-lg bg-paper shadow-3 sm:rounded-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className={`flex items-start gap-3 px-5 pt-5 ${tone === 'stop' ? 'text-fault-ink' : ''}`}>
          <h2 id={titleId} className="min-w-0 flex-1 text-base font-semibold text-ink">
            {title}
          </h2>
          <button type="button" className="btn btn-quiet btn-sm -mr-2 -mt-1.5" onClick={onClose} aria-label="Đóng">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-5 py-3 text-sm text-ink-2">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-5 pb-5 pt-1">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toasts: brief confirmations only. Unresolved problems use persistent banners. ---------- */

type ToastTone = 'success' | 'info' | 'warn' | 'error';
let pushToast: ((s: string, tone: ToastTone) => void) | null = null;
export function toast(s: string, tone: ToastTone = 'success') {
  pushToast?.(s, tone);
}
export function ToastHost() {
  const [msgs, setMsgs] = useState<{ id: number; s: string; tone: ToastTone }[]>([]);
  useEffect(() => {
    pushToast = (s, tone) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m.slice(-2), { id, s, tone }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 4200);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  const ic: Record<ToastTone, IconName> = { success: 'checkCircle', info: 'info', warn: 'alert', error: 'stop' };
  const cl: Record<ToastTone, string> = { success: 'text-lime', info: 'text-paper', warn: 'text-[rgb(240_190_90)]', error: 'text-[rgb(245_140_125)]' };
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {msgs.map((m) => (
        <div key={m.id} className="rise on-dark pointer-events-auto flex max-w-md items-center gap-2.5 rounded bg-ink px-4 py-2.5 text-sm text-paper shadow-2">
          <Icon name={ic[m.tone]} size={17} className={cl[m.tone]} strokeWidth={2} />
          {m.s}
        </div>
      ))}
    </div>
  );
}

/** Small tooltip for chart marks and icon buttons. */
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-[11.5px] font-medium text-paper shadow-2 group-focus-within/tip:block group-hover/tip:block"
      >
        {label}
      </span>
    </span>
  );
}
