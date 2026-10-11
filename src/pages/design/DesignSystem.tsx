/**
 * Hệ thống thiết kế RE: tokens, components and status rules on one reference page.
 * Every specimen is rendered with the real components from components/ui.tsx, so the page
 * cannot drift from the product. Sample numbers are demo data and are labelled as such.
 */
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Icon, ReMark, Wordmark, type IconName } from '../../components/icons';
import {
  Alert,
  Badge,
  Button,
  ConnBadge,
  DemoTag,
  Dialog,
  Drawer,
  EmptyState,
  EstimateTag,
  FillMeter,
  Metric,
  NumberField,
  OpBadge,
  SearchField,
  SectionHead,
  Segmented,
  SelectField,
  Skeleton,
  StaleTag,
  Switch,
  Tabs,
  TextField,
  Tip,
  toast,
  type Tone,
} from '../../components/ui';
import { Breakdown, DailyBars } from '../../components/charts';
import type { OpStatus } from '../../domain/ops';
import { n0, n1, n2 } from '../../lib/format';

const SECTIONS = [
  { id: 'ds-principles', title: 'Nguyên tắc', short: 'Nguyên tắc' },
  { id: 'ds-color', title: 'Màu', short: 'Màu' },
  { id: 'ds-type', title: 'Chữ', short: 'Chữ' },
  { id: 'ds-space', title: 'Khoảng cách, lưới và bo góc', short: 'Khoảng cách' },
  { id: 'ds-icons', title: 'Biểu tượng', short: 'Biểu tượng' },
  { id: 'ds-buttons', title: 'Nút', short: 'Nút' },
  { id: 'ds-forms', title: 'Biểu mẫu', short: 'Biểu mẫu' },
  { id: 'ds-badges', title: 'Huy hiệu trạng thái', short: 'Huy hiệu' },
  { id: 'ds-metrics', title: 'Chỉ số', short: 'Chỉ số' },
  { id: 'ds-tables', title: 'Bảng và bộ lọc', short: 'Bảng' },
  { id: 'ds-overlays', title: 'Lớp phủ và phản hồi', short: 'Lớp phủ' },
  { id: 'ds-charts', title: 'Biểu đồ', short: 'Biểu đồ' },
  { id: 'ds-nav', title: 'Điều hướng', short: 'Điều hướng' },
  { id: 'ds-states', title: 'Trạng thái', short: 'Trạng thái' },
  { id: 'ds-a11y', title: 'Khả năng tiếp cận', short: 'Tiếp cận' },
  { id: 'ds-responsive', title: 'Responsive', short: 'Responsive' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
const IDS: readonly SectionId[] = SECTIONS.map((s) => s.id);
const num = (id: SectionId) => String(IDS.indexOf(id) + 1).padStart(2, '0');

const OPS: OpStatus[] = ['accepting', 'warning', 'stopped', 'jam', 'estop'];

/* ---------- Data ---------- */

const COLOR_GROUPS: { name: string; tokens: { key: string; rgb: string; role: string }[] }[] = [
  {
    name: 'Nền',
    tokens: [
      { key: 'paper', rgb: '245 243 237', role: 'Nền trang. Giấy ấm, không dùng trắng tinh.' },
      { key: 'panel', rgb: '252 251 248', role: 'Thẻ, bảng, khối nội dung trên nền giấy.' },
      { key: 'sunk', rgb: '236 233 225', role: 'Vùng chìm: đầu bảng, rãnh thanh đo, huy hiệu trung tính.' },
    ],
  },
  {
    name: 'Chữ',
    tokens: [
      { key: 'ink', rgb: '33 35 33', role: 'Chữ chính, tiêu đề, số liệu.' },
      { key: 'ink-2', rgb: '58 61 58', role: 'Chữ thân và mô tả.' },
      { key: 'muted', rgb: '96 99 93', role: 'Nhãn phụ, chú thích, thời gian.' },
    ],
  },
  {
    name: 'Đường kẻ',
    tokens: [
      { key: 'line', rgb: '220 216 205', role: 'Viền thẻ và đường chia (trang trí).' },
      { key: 'line-strong', rgb: '190 185 172', role: 'Viền nút phụ, vùng trống, đường kẻ nhấn.' },
      { key: 'field', rgb: '140 136 124', role: 'Viền ô nhập và rãnh công tắc tắt. Đủ 3:1 để nhận ra điều khiển.' },
      { key: 'steel', rgb: '196 199 196', role: 'Dự trữ cho bề mặt kim loại trong hình vẽ; chưa dùng trong giao diện.' },
    ],
  },
  {
    name: 'Thương hiệu',
    tokens: [
      { key: 'forest', rgb: '30 86 60', role: 'Hành động chính, liên kết, trạng thái đang nhận.' },
      { key: 'forest-ink', rgb: '21 62 43', role: 'Chữ xanh trên nền nhạt, nút chính khi rê chuột.' },
      { key: 'forest-tint', rgb: '226 237 229', role: 'Nền huy hiệu đang nhận và thông báo thành công.' },
      { key: 'lime', rgb: '178 206 62', role: 'Điểm nhấn nhỏ: khe nhận trên logo, khoảnh khắc chai được nhận. Không dùng làm chữ trên nền sáng.' },
      { key: 'lime-tint', rgb: '239 245 215', role: 'Nền huy hiệu điểm thưởng.' },
    ],
  },
  {
    name: 'Trạng thái',
    tokens: [
      { key: 'amber', rgb: '176 110 8', role: 'Thanh đo từ 80 %. Chỉ làm mảng màu, không làm chữ.' },
      { key: 'amber-ink', rgb: '128 80 6', role: 'Chữ và biểu tượng cảnh báo thu gom.' },
      { key: 'amber-tint', rgb: '250 238 212', role: 'Nền cảnh báo.' },
      { key: 'fault', rgb: '190 50 38', role: 'Thanh đo từ 95 %, nút nguy hiểm.' },
      { key: 'fault-ink', rgb: '158 36 26', role: 'Chữ dừng nhận, lỗi thiết bị, lỗi nhập liệu.' },
      { key: 'fault-tint', rgb: '249 227 223', role: 'Nền lỗi và dừng nhận.' },
      { key: 'slate', rgb: '88 101 112', role: 'Số đo cũ, mất kết nối.' },
      { key: 'slate-tint', rgb: '230 233 235', role: 'Nền số đo cũ.' },
      { key: 'info', rgb: '52 92 140', role: 'Thông tin trung tính, không đòi hành động.' },
    ],
  },
  {
    name: 'Bản đồ',
    tokens: [
      { key: 'route', rgb: '26 102 214', role: 'Đường cần đi và xe trên bản đồ, trạm nhanh nhất. Màu xanh tài xế quen từ ứng dụng dẫn đường.' },
      { key: 'route-ink', rgb: '16 70 156', role: 'Viền đường đi, chữ thời gian lái xe.' },
    ],
  },
];

/* Ratios computed with the WCAG 2.x relative-luminance formula from the RGB values in index.css. */
type Pair = { fg: string; bg: string; use: string; ratio: number; need: 4.5 | 3; kind: 'text' | 'ui' };
const CONTRAST: Pair[] = [
  { fg: 'ink', bg: 'paper', use: 'Chữ chính trên trang', ratio: 14.26, need: 4.5, kind: 'text' },
  { fg: 'ink', bg: 'panel', use: 'Chữ chính trong thẻ', ratio: 15.29, need: 4.5, kind: 'text' },
  { fg: 'ink', bg: 'sunk', use: 'Đầu bảng, vùng chìm', ratio: 13.04, need: 4.5, kind: 'text' },
  { fg: 'ink-2', bg: 'paper', use: 'Chữ thân', ratio: 9.92, need: 4.5, kind: 'text' },
  { fg: 'ink-2', bg: 'panel', use: 'Chữ thân trong thẻ', ratio: 10.63, need: 4.5, kind: 'text' },
  { fg: 'ink-2', bg: 'sunk', use: 'Huy hiệu trung tính', ratio: 9.07, need: 4.5, kind: 'text' },
  { fg: 'muted', bg: 'paper', use: 'Nhãn phụ, thời gian', ratio: 5.5, need: 4.5, kind: 'text' },
  { fg: 'muted', bg: 'panel', use: 'Chú thích trong thẻ', ratio: 5.9, need: 4.5, kind: 'text' },
  { fg: 'muted', bg: 'sunk', use: 'Chú thích trên vùng chìm', ratio: 5.03, need: 4.5, kind: 'text' },
  { fg: 'forest', bg: 'paper', use: 'Liên kết, nút ghost', ratio: 7.72, need: 4.5, kind: 'text' },
  { fg: 'forest', bg: 'panel', use: 'Liên kết trong thẻ', ratio: 8.28, need: 4.5, kind: 'text' },
  { fg: 'forest', bg: 'forest-tint', use: 'Nút ghost khi rê chuột', ratio: 7.13, need: 4.5, kind: 'text' },
  { fg: 'forest-ink', bg: 'paper', use: 'Chữ xanh đậm', ratio: 10.78, need: 4.5, kind: 'text' },
  { fg: 'forest-ink', bg: 'panel', use: 'Chữ xanh đậm trong thẻ', ratio: 11.56, need: 4.5, kind: 'text' },
  { fg: 'forest-ink', bg: 'forest-tint', use: 'Huy hiệu đang nhận', ratio: 9.95, need: 4.5, kind: 'text' },
  { fg: 'forest-ink', bg: 'lime-tint', use: 'Huy hiệu điểm thưởng', ratio: 10.66, need: 4.5, kind: 'text' },
  { fg: 'amber-ink', bg: 'paper', use: 'Chữ cảnh báo', ratio: 6.17, need: 4.5, kind: 'text' },
  { fg: 'amber-ink', bg: 'panel', use: 'Chữ cảnh báo trong thẻ', ratio: 6.61, need: 4.5, kind: 'text' },
  { fg: 'amber-ink', bg: 'amber-tint', use: 'Huy hiệu cần thu gom', ratio: 5.95, need: 4.5, kind: 'text' },
  { fg: 'fault-ink', bg: 'paper', use: 'Chữ lỗi, dừng nhận', ratio: 6.96, need: 4.5, kind: 'text' },
  { fg: 'fault-ink', bg: 'panel', use: 'Lỗi nhập liệu trong thẻ', ratio: 7.46, need: 4.5, kind: 'text' },
  { fg: 'fault-ink', bg: 'fault-tint', use: 'Huy hiệu dừng nhận', ratio: 6.28, need: 4.5, kind: 'text' },
  { fg: 'slate', bg: 'paper', use: 'Số đo cũ', ratio: 5.39, need: 4.5, kind: 'text' },
  { fg: 'slate', bg: 'panel', use: 'Số đo cũ trong thẻ', ratio: 5.78, need: 4.5, kind: 'text' },
  { fg: 'slate', bg: 'slate-tint', use: 'Huy hiệu mất kết nối', ratio: 4.91, need: 4.5, kind: 'text' },
  { fg: 'info', bg: 'paper', use: 'Biểu tượng thông tin', ratio: 6.19, need: 4.5, kind: 'text' },
  { fg: 'ink-2', bg: 'amber-tint', use: 'Nội dung banner cảnh báo', ratio: 9.56, need: 4.5, kind: 'text' },
  { fg: 'ink-2', bg: 'fault-tint', use: 'Nội dung banner dừng nhận', ratio: 8.95, need: 4.5, kind: 'text' },
  { fg: 'ink-2', bg: 'slate-tint', use: 'Nội dung banner mất kết nối', ratio: 9.02, need: 4.5, kind: 'text' },
  { fg: 'white', bg: 'forest', use: 'Nhãn nút chính', ratio: 8.57, need: 4.5, kind: 'text' },
  { fg: 'white', bg: 'route', use: 'Số thứ hạng trạm nhanh nhất', ratio: 5.36, need: 4.5, kind: 'text' },
  { fg: 'route-ink', bg: 'paper', use: 'Thời gian lái xe, nút căn giữa', ratio: 7.96, need: 4.5, kind: 'text' },
  { fg: 'white', bg: 'amber-ink', use: 'Dải cảnh báo "không có dữ liệu đường"', ratio: 6.84, need: 4.5, kind: 'text' },
  { fg: 'route', bg: 'paper', use: 'Đường đi trên bản đồ', ratio: 4.83, need: 3, kind: 'ui' },
  { fg: 'white', bg: 'forest-ink', use: 'Nút chính khi rê chuột', ratio: 11.96, need: 4.5, kind: 'text' },
  { fg: 'white', bg: 'fault', use: 'Nhãn nút nguy hiểm', ratio: 5.72, need: 4.5, kind: 'text' },
  { fg: 'paper', bg: 'ink', use: 'Toast, phân đoạn đang chọn', ratio: 14.26, need: 4.5, kind: 'text' },
  { fg: 'forest', bg: 'paper', use: 'Vòng focus 2 px', ratio: 7.72, need: 3, kind: 'ui' },
  { fg: 'lime', bg: 'ink', use: 'Biểu tượng toast thành công', ratio: 8.89, need: 3, kind: 'ui' },
  { fg: 'forest', bg: 'sunk', use: 'Thanh đo dưới 80 %', ratio: 7.06, need: 3, kind: 'ui' },
  { fg: 'amber', bg: 'sunk', use: 'Thanh đo 80–94 %', ratio: 3.41, need: 3, kind: 'ui' },
  { fg: 'fault', bg: 'sunk', use: 'Thanh đo từ 95 %', ratio: 4.71, need: 3, kind: 'ui' },
  { fg: 'field', bg: 'white', use: 'Viền ô nhập', ratio: 3.54, need: 3, kind: 'ui' },
  { fg: 'field', bg: 'paper', use: 'Rãnh công tắc khi tắt', ratio: 3.19, need: 3, kind: 'ui' },
];

const TYPE_SCALE: { name: string; cls: string; size: string; lh: string; weight: string; use: string }[] = [
  { name: '5xl', cls: 'text-5xl', size: '46', lh: '54', weight: 'font-bold', use: 'Dự trữ; chưa dùng trong bản mẫu.' },
  { name: '4xl', cls: 'text-4xl', size: '38', lh: '46', weight: 'font-bold', use: 'Số lớn: điểm vừa cộng, Metric cỡ lg.' },
  { name: '3xl', cls: 'text-3xl', size: '30', lh: '38', weight: 'font-semibold', use: 'Tiêu đề mục trang giới thiệu (từ md), mã trạm cho tài xế.' },
  { name: '2xl', cls: 'text-2xl', size: '24', lh: '32', weight: 'font-semibold', use: 'Tiêu đề trang ứng dụng và RE Hub; giá trị chỉ số.' },
  { name: 'xl', cls: 'text-xl', size: '20', lh: '28', weight: 'font-semibold', use: 'Tiêu đề thẻ lớn.' },
  { name: 'lg', cls: 'text-lg', size: '17', lh: '26', weight: 'font-semibold', use: 'Tiêu đề mục (SectionHead).' },
  { name: 'base', cls: 'text-base', size: '15', lh: '24', weight: 'font-normal', use: 'Chữ thân mặc định.' },
  { name: 'sm', cls: 'text-sm', size: '13,5', lh: '20', weight: 'font-normal', use: 'Bảng, biểu mẫu, banner.' },
  { name: 'xs', cls: 'text-xs', size: '12', lh: '17', weight: 'font-normal', use: 'Nhãn phụ, huy hiệu, chú thích.' },
  { name: '2xs', cls: 'text-2xs', size: '11', lh: '16', weight: 'font-medium', use: 'Nhãn kỹ thuật, eyebrow (.eyebrow cùng cỡ).' },
];

const SPACE: { px: number; tw: string; use: string }[] = [
  { px: 4, tw: '1', use: 'Giữa biểu tượng và nhãn nhỏ' },
  { px: 8, tw: '2', use: 'Giữa các nút, trong huy hiệu' },
  { px: 12, tw: '3', use: 'Đệm ô nhập, khoảng hàng bảng' },
  { px: 16, tw: '4', use: 'Lề điện thoại, đệm thẻ' },
  { px: 24, tw: '6', use: 'Rãnh lưới desktop, giữa các khối' },
  { px: 32, tw: '8', use: 'Giữa các nhóm nội dung' },
  { px: 48, tw: '12', use: 'Giữa các mục lớn' },
  { px: 64, tw: '16', use: 'Khoảng thở trên trang giới thiệu' },
];

const ICON_GROUPS: { name: string; icons: IconName[] }[] = [
  { name: 'Thao tác', icons: ['check', 'x', 'plus', 'minus', 'chevronRight', 'chevronLeft', 'chevronDown', 'arrowRight', 'arrowLeft', 'menu'] },
  { name: 'Trạng thái', icons: ['alert', 'stop', 'info', 'checkCircle', 'wifiOff', 'wifi', 'clock', 'sync'] },
  {
    name: 'Nghiệp vụ và giao diện',
    icons: [
      'bottle', 'station', 'bin', 'truck', 'route', 'mapPin', 'map', 'qr', 'scale', 'camera', 'barcode', 'rollers', 'drop', 'sensor', 'wrench', 'file',
      'fileMissing', 'download', 'upload', 'search', 'filter', 'calendar', 'home', 'gift', 'history', 'user', 'users', 'building', 'settings', 'grid',
      'list', 'layers', 'link', 'external', 'eye', 'play', 'pause', 'refresh', 'flag', 'bolt', 'leaf', 'sliders', 'dot', 'hand', 'door', 'tray',
      'printer', 'phone', 'monitor', 'sparkle',
    ],
  },
];

type StationRow = { id: string; name: string; op: OpStatus; pct: number; online: boolean; offMin?: number; at: string };
/* Demo rows, already in priority order: stopped, disconnected, needs collection, accepting. */
const ROWS: StationRow[] = [
  { id: 'RE-003', name: 'Thư viện trung tâm', op: 'stopped', pct: 96, online: true, at: '14:58' },
  { id: 'RE-004', name: 'Nhà thi đấu', op: 'accepting', pct: 63, online: false, offMin: 27, at: '14:32' },
  { id: 'RE-002', name: 'Ký túc xá B', op: 'warning', pct: 84, online: true, at: '14:57' },
  { id: 'RE-001', name: 'Sảnh nhà học A', op: 'accepting', pct: 42, online: true, at: '14:58' },
];

const DAILY_KG = [18.4, 21.1, 19.6, 24.3, 22.8, 15.2, 12.9, 20.5, 23.7, 25.1, 21.9, 26.4, 16.8, 27.3];
const DAILY = DAILY_KG.map((kg, i) => ({ day: new Date(2026, 8, 27 + i).getTime(), kg }));

const RESPONSIVE: { product: string; d: string; t: string; m: string }[] = [
  {
    product: 'RE Hub',
    d: 'Thanh bên 240 px cố định. Danh sách cần xử lý và bảng trạm đặt cạnh nhau.',
    t: 'Thanh bên thu gọn, mở bằng nút menu. Danh sách cần xử lý ở trên, bảng ở dưới và cuộn ngang.',
    m: 'Menu mở dạng bottom sheet. Danh sách ưu tiên lên đầu (dừng nhận, mất kết nối, cần thu gom); bảng chuyển thành thẻ.',
  },
  {
    product: 'Ứng dụng trả chai',
    d: 'Khung điện thoại 390 px ở giữa; trạm mô phỏng và bảng demo ở hai bên.',
    t: 'Khung điện thoại và bảng demo; trạm mô phỏng xếp dưới bảng demo.',
    m: 'Một cột toàn màn hình, thanh tab dưới; bảng demo mở từ nút nổi.',
  },
  {
    product: 'Tài xế',
    d: 'Một cột ở giữa, rộng như điện thoại; không kéo giãn nút và danh sách.',
    t: 'Một cột ở giữa như desktop.',
    m: 'Bố cục gốc: điểm dừng tiếp theo trên cùng, nút hành động lớn ở cuối màn hình.',
  },
  {
    product: 'Trang giới thiệu',
    d: 'Nội dung tối đa 1.200 px; tiêu đề và hình trạm hai cột.',
    t: 'Hai cột hẹp hoặc xếp chồng; chữ giữ cỡ, hình nhỏ lại.',
    m: 'Một cột: tiêu đề, nút chính, rồi hình trạm; menu thu gọn.',
  },
];

/* ---------- Helpers ---------- */

const col = (k: string) => (k === 'white' ? 'rgb(255 255 255)' : `rgb(var(--c-${k}))`);
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

function useReducedMotion() {
  const q = '(prefers-reduced-motion: reduce)';
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function useActiveSection() {
  const [active, setActive] = useState<SectionId>(IDS[0]);
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        let cur: SectionId = IDS[0];
        for (const id of IDS) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= 150) cur = id;
        }
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = IDS[IDS.length - 1];
        setActive(cur);
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, []);
  return [active, setActive] as const;
}

function Section({ id, tools, intro, children }: { id: SectionId; tools?: ReactNode; intro?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const title = SECTIONS.find((s) => s.id === id)!.title;
  // SectionHead takes no id; the heading is the in-page nav's focus target, so tag it here.
  useEffect(() => {
    const h = ref.current?.querySelector('h2');
    if (!h) return;
    h.id = `${id}-title`;
    h.tabIndex = -1;
  }, [id]);
  return (
    <section ref={ref} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-[104px] border-t border-line pt-8 first:border-t-0 first:pt-0 lg:scroll-mt-16">
      <SectionHead eyebrow={num(id)} title={title}>
        {tools}
      </SectionHead>
      {intro && <p className="mb-5 max-w-[70ch] text-sm text-ink-2">{intro}</p>}
      {children}
    </section>
  );
}

function H3({ children, aside, className = '' }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 flex flex-wrap items-center justify-between gap-2 ${className}`}>
      <h3 className="text-sm font-semibold text-ink">{children}</h3>
      {aside}
    </div>
  );
}

function Rules({ items, className = '' }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={`flex flex-col gap-1.5 text-sm text-ink-2 ${className}`}>
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <Icon name="check" size={15} className="mt-[3px] text-forest" strokeWidth={2.1} />
          <span className="min-w-0">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-5">
      <dt className="text-sm font-medium text-ink">
        {label}
        {hint && <span className="mt-0.5 block text-xs font-normal text-muted">{hint}</span>}
      </dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-2">{children}</dd>
    </div>
  );
}

/* ---------- Sections ---------- */

function Principles() {
  const items: { icon: IconName; title: string; body: string; demo: ReactNode }[] = [
    {
      icon: 'arrowRight',
      title: 'Một hành động tiếp theo cho mỗi màn hình',
      body: 'Mỗi màn hình có đúng một nút chính. Thao tác khác là nút phụ, nút nhẹ hoặc liên kết.',
      demo: (
        <>
          <Button variant="primary" size="sm">
            Lên lịch thu gom
          </Button>
          <Button variant="quiet" size="sm">
            Để sau
          </Button>
        </>
      ),
    },
    {
      icon: 'eye',
      title: 'Trạng thái không chỉ bằng màu',
      body: 'Luôn có biểu tượng, nhãn chữ và con số khi có. Người mù màu, màn hình chói nắng hay bản in đen trắng vẫn đọc được.',
      demo: (
        <>
          <OpBadge op="warning" />
          <span className="tnum text-sm font-semibold text-ink">84 %</span>
        </>
      ),
    },
    {
      icon: 'scale',
      title: 'Số đo và ước tính tách riêng',
      body: 'Số chai đếm tại trạm và khối lượng cân tại điểm tiếp nhận là số đo. Khối lượng suy từ số chai là ước tính và luôn gắn nhãn.',
      demo: (
        <>
          <span className="tnum text-sm font-semibold text-ink">{n1(28.2)} kg</span>
          <EstimateTag />
        </>
      ),
    },
    {
      icon: 'clock',
      title: 'Số đo cũ hiện là số đo cũ',
      body: 'Khi trạm mất kết nối, giữ giá trị cuối kèm thời điểm, gạch chéo và màu slate. Không đoán giá trị hiện tại.',
      demo: (
        <div className="flex w-full max-w-[280px] flex-col gap-1.5">
          <FillMeter pct={63} stale size="sm" />
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <StaleTag /> lần cuối 14:32
          </span>
        </div>
      ),
    },
    {
      icon: 'flag',
      title: 'Đề xuất khác với đã kiểm chứng',
      body: 'RE là ý tưởng, chưa có mẫu thử. Số liệu mẫu gắn nhãn Dữ liệu demo; con số tương lai gắn nhãn Dự phóng.',
      demo: (
        <>
          <DemoTag />
          <Badge tone="slate" icon="sparkle">
            Dự phóng
          </Badge>
        </>
      ),
    },
    {
      icon: 'checkCircle',
      title: 'Điểm chỉ cộng sau khi xác nhận vào thùng',
      body: 'Ứng dụng chỉ cộng điểm khi cảm biến xác nhận chai đã qua rulo và rơi vào thùng chứa. Trước đó điểm ở trạng thái chờ.',
      demo: (
        <>
          <Badge tone="slate" icon="clock">
            Chờ xác nhận
          </Badge>
          <Icon name="arrowRight" size={14} className="text-muted" />
          <Badge tone="lime" icon="check">
            Đã cộng điểm
          </Badge>
        </>
      ),
    },
  ];
  return (
    <ol className="grid gap-x-8 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((p, i) => (
        <li key={p.title} className="flex min-w-0 flex-col gap-2 border-t border-line pt-4">
          <div className="flex items-center gap-2">
            <span className="id-tag text-[11px] text-muted">{String(i + 1).padStart(2, '0')}</span>
            <Icon name={p.icon} size={17} className="text-forest" />
          </div>
          <h3 className="font-semibold text-ink">{p.title}</h3>
          <p className="text-sm text-ink-2">{p.body}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">{p.demo}</div>
        </li>
      ))}
    </ol>
  );
}

function Colors() {
  return (
    <>
      <div className="flex flex-col gap-8">
        {COLOR_GROUPS.map((g) => (
          <div key={g.name}>
            <H3>{g.name}</H3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
              {g.tokens.map((t) => (
                <li key={t.key} className="min-w-0">
                  <div className="h-14 rounded-sm border border-line" style={{ background: col(t.key) }} aria-hidden />
                  <div className="mt-2 text-sm font-semibold text-ink">{t.key}</div>
                  <div className="id-tag break-all text-[11.5px] text-muted">--c-{t.key}</div>
                  <div className="id-tag text-[11.5px] text-muted">rgb({t.rgb})</div>
                  <p className="mt-1 text-xs text-ink-2">{t.role}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <H3 className="mt-10">Độ tương phản (WCAG 2.x)</H3>
      <p className="mb-3 max-w-[70ch] text-sm text-ink-2">
        Tính bằng công thức độ chói tương đối của WCAG từ đúng giá trị RGB ở trên. Ngưỡng AA: 4,5:1 cho chữ thường, 3:1 cho chữ lớn và thành phần giao diện.
      </p>
      <div className="overflow-x-auto rounded border border-line bg-panel scroll-thin">
        <table className="table-base min-w-[680px]">
          <caption className="sr-only">Tỉ lệ tương phản của các cặp màu đang dùng</caption>
          <thead>
            <tr>
              <th scope="col">Mẫu</th>
              <th scope="col">Cặp màu</th>
              <th scope="col">Dùng cho</th>
              <th scope="col" className="text-right">
                Tỉ lệ
              </th>
              <th scope="col" className="text-right">
                Ngưỡng
              </th>
              <th scope="col">Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {CONTRAST.map((c) => {
              const pass = c.ratio >= c.need;
              return (
                <tr key={`${c.fg}-${c.bg}-${c.use}`}>
                  <td>
                    {c.kind === 'text' ? (
                      <span className="inline-grid h-7 w-10 place-items-center rounded-sm border border-line text-sm font-semibold" style={{ color: col(c.fg), background: col(c.bg) }} aria-hidden>
                        Aa
                      </span>
                    ) : (
                      <span className="inline-grid h-7 w-10 place-items-center rounded-sm border border-line" style={{ background: col(c.bg) }} aria-hidden>
                        <span className="h-2.5 w-6 rounded-[2px]" style={{ background: col(c.fg) }} />
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    <span className="id-tag text-ink">{c.fg}</span> <span className="text-muted">trên</span> <span className="id-tag text-ink">{c.bg}</span>
                  </td>
                  <td className="text-ink-2">{c.use}</td>
                  <td className="tnum whitespace-nowrap text-right font-semibold text-ink">{n2(c.ratio)}:1</td>
                  <td className="tnum whitespace-nowrap text-right text-muted">
                    {n1(c.need)}:1 {c.kind === 'ui' ? 'UI' : ''}
                  </td>
                  <td>
                    {pass ? (
                      <Badge tone="forest" icon="check">
                        Đạt
                      </Badge>
                    ) : (
                      <Badge tone="fault" icon="x">
                        Không đạt
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Alert tone="info" title="Đã sửa hai cặp từng không đạt" className="mt-4">
        Thanh đo 80–94 % từng dùng amber 196 128 18 (2,69:1 trên sunk); nay là 176 110 8. Viền ô nhập từng dùng line-strong (1,96:1 trên nền trắng); nay dùng token riêng field. Tỷ lệ tính bằng công thức độ chói tương đối WCAG 2.x, chưa kiểm tra với người dùng.
      </Alert>
    </>
  );
}

function Typography() {
  const nums = ['1.284', '11.111', '96,4 %', '7,1 %'];
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card min-w-0 p-5">
          <div className="eyebrow">Chữ giao diện</div>
          <div className="mt-2 text-2xl font-semibold text-ink">Be Vietnam Pro</div>
          <p className="mt-2 break-words text-lg text-ink-2">Ăâ Đđ Êê Ôô Ơơ Ưư · Trạm đầy, dừng nhận.</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
            <span className="font-normal">400 Thường</span>
            <span className="font-medium">500 Vừa</span>
            <span className="font-semibold">600 Đậm vừa</span>
            <span className="font-bold">700 Đậm</span>
          </div>
          <p className="mt-3 text-xs text-muted">Thiết kế cho tiếng Việt: dấu thanh không chạm dòng trên ở khoảng cách dòng 1,5.</p>
        </div>
        <div className="card min-w-0 p-5">
          <div className="eyebrow">Mã và nhãn kỹ thuật</div>
          <div className="mt-2 font-mono text-2xl font-semibold text-ink">JetBrains Mono</div>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-lg text-ink-2">
            <span className="id-tag">RE-003</span>
            <span className="id-tag">LO-0002</span>
          </p>
          <p className="mt-3 text-xs text-muted">
            Chỉ cho mã trạm, mã lô, nhãn trục và eyebrow (<span className="id-tag">.id-tag</span>, <span className="id-tag">.eyebrow</span>). Không dùng cho đoạn văn.
          </p>
        </div>
      </div>

      <H3 className="mt-8">Thang cỡ chữ</H3>
      <div className="border-t border-line">
        {TYPE_SCALE.map((t) => (
          <div key={t.name} className="grid gap-x-6 gap-y-1.5 border-b border-line py-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-baseline">
            <div className="min-w-0">
              <div className="id-tag text-xs font-semibold text-ink">text-{t.name}</div>
              <div className="tnum text-xs text-muted">
                {t.size} / {t.lh} px
              </div>
              <div className="text-xs text-muted">{t.use}</div>
            </div>
            <div className={`min-w-0 break-words text-ink ${t.cls} ${t.weight}`}>Trả chai PET. Nhận điểm.</div>
          </div>
        ))}
      </div>

      <H3 className="mt-8">Chữ số đều</H3>
      <div className="grid max-w-md grid-cols-2 gap-6">
        <div className="min-w-0">
          <div className="eyebrow mb-2">Mặc định</div>
          <ul className="proportional-nums flex flex-col gap-1 border-l-2 border-line pl-3 text-right text-lg font-semibold text-ink">
            {nums.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <div className="eyebrow mb-2">.tnum</div>
          <ul className="tnum flex flex-col gap-1 border-l-2 border-forest pl-3 text-right text-lg font-semibold text-ink">
            {nums.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 max-w-[70ch] text-xs text-muted">
        Mọi con số trong bảng, chỉ số và thanh đo dùng <span className="id-tag">.tnum</span> để cột thẳng hàng khi giá trị đổi. Số theo kiểu vi-VN: dấu chấm phân nghìn, dấu phẩy thập phân, khoảng trắng trước %.
      </p>
    </>
  );
}

function GridDiagram({ cols, side, tabbar, className }: { cols: number; side?: 'full' | 'rail'; tabbar?: boolean; className: string }) {
  return (
    <div className={`mx-auto flex overflow-hidden rounded-sm border border-line-strong bg-white ${className}`} aria-hidden>
      {side && <div className={`shrink-0 border-r border-line bg-sunk ${side === 'full' ? 'w-[17%]' : 'w-[7%]'}`} />}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="grid flex-1 gap-1 px-1.5 py-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="rounded-[1px] bg-forest-tint" />
          ))}
        </div>
        {tabbar && <div className="h-4 shrink-0 border-t border-line bg-sunk" />}
      </div>
    </div>
  );
}

function Spacing() {
  const grids = [
    { w: '1440', name: 'Máy tính', diagram: <GridDiagram cols={12} side="full" className="h-28 w-full" />, spec: ['12 cột, rãnh 24 px', 'Thanh bên RE Hub 240 px', 'Nội dung trang giới thiệu tối đa 1.200 px'] },
    { w: '834', name: 'Máy tính bảng', diagram: <GridDiagram cols={8} side="rail" className="h-36 w-[124px]" />, spec: ['8 cột, rãnh 20 px', 'Thanh bên thu gọn, mở khi cần'] },
    { w: '390', name: 'Điện thoại', diagram: <GridDiagram cols={4} tabbar className="h-36 w-[72px]" />, spec: ['4 cột, lề 16 px', 'Thanh tab dưới (ứng dụng)', 'Bottom sheet thay thanh bên (RE Hub)'] },
  ];
  const radii = [
    { cls: 'rounded-sm', px: 4, use: 'Ô nhập, thanh đo, nhãn nhỏ' },
    { cls: 'rounded', px: 6, use: 'Nút, thẻ, banner (mặc định)' },
    { cls: 'rounded-lg', px: 10, use: 'Hộp thoại, khối minh họa' },
    { cls: 'rounded-xl', px: 14, use: 'Hiếm khi dùng; khung lớn' },
  ];
  const shadows = [
    { cls: 'shadow-1', use: 'Nút chính, thẻ nổi, núm công tắc' },
    { cls: 'shadow-2', use: 'Tooltip, toast' },
    { cls: 'shadow-3', use: 'Ngăn kéo, hộp thoại' },
  ];
  return (
    <>
      <H3>Thang khoảng cách, bội số 4 px</H3>
      <ul className="flex flex-col gap-2.5">
        {SPACE.map((s) => (
          <li key={s.px} className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[52px_72px_80px_minmax(0,1fr)]">
            <span className="tnum text-sm font-semibold text-ink">{s.px} px</span>
            <span className="id-tag hidden text-xs text-muted sm:block">p-{s.tw}</span>
            <span className="h-3 rounded-[2px] bg-forest/80" style={{ width: s.px }} aria-hidden />
            <span className="col-start-2 min-w-0 text-xs text-ink-2 sm:col-start-auto">{s.use}</span>
          </li>
        ))}
      </ul>

      <H3 className="mt-10">Lưới theo màn hình</H3>
      <div className="grid gap-4 sm:grid-cols-3">
        {grids.map((g) => (
          <div key={g.w} className="card flex min-w-0 flex-col gap-3 p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tnum text-lg font-semibold text-ink">{g.w} px</span>
              <span className="text-xs text-muted">{g.name}</span>
            </div>
            <div className="flex h-36 items-center">{g.diagram}</div>
            <ul className="flex flex-col gap-1 text-xs text-ink-2">
              {g.spec.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div className="min-w-0">
          <H3>Bo góc</H3>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
            {radii.map((r) => (
              <li key={r.cls} className="min-w-0">
                <div className={`h-16 w-16 border border-line-strong bg-panel ${r.cls}`} aria-hidden />
                <div className="id-tag mt-2 text-xs font-semibold text-ink">{r.cls}</div>
                <div className="tnum text-xs text-muted">{r.px} px</div>
                <div className="text-xs text-ink-2">{r.use}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Bo tròn hoàn toàn chỉ cho huy hiệu, công tắc và nút giữa thanh tab.</p>
        </div>
        <div className="min-w-0">
          <H3>Đổ bóng</H3>
          <ul className="grid grid-cols-3 gap-4 rounded bg-sunk/60 p-4 sm:p-6">
            {shadows.map((s) => (
              <li key={s.cls} className="min-w-0">
                <div className={`h-16 rounded border border-line bg-white ${s.cls}`} aria-hidden />
                <div className="id-tag mt-3 text-xs font-semibold text-ink">{s.cls}</div>
                <div className="text-xs text-ink-2">{s.use}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Bóng mảnh, màu mực, không có quầng màu. Thẻ phẳng dùng viền thay cho bóng.</p>
        </div>
      </div>
    </>
  );
}

function Icons() {
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-5">
        <div className="relative h-[120px] w-[120px] shrink-0 rounded-sm border border-line bg-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full">
            {Array.from({ length: 25 }, (_, i) => (
              <g key={i} stroke="rgb(var(--c-line))" strokeWidth={i % 4 === 0 ? 0.06 : 0.03}>
                <line x1={i} x2={i} y1={0} y2={24} />
                <line x1={0} x2={24} y1={i} y2={i} />
              </g>
            ))}
          </svg>
          <Icon name="bottle" size={120} className="relative text-forest" />
        </div>
        <div className="min-w-0 max-w-[48ch] text-sm text-ink-2">
          <p>Lưới 24 × 24, nét 1,75 px, đầu và góc nét tròn. Vẽ riêng cho RE để biểu tượng trạng thái giống nhau trên website, ứng dụng và RE Hub.</p>
          <p className="mt-1.5 text-xs text-muted">Cỡ dùng: 14 trong huy hiệu, 16–18 trong nút và ô nhập, 20–24 trong điều hướng.</p>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        {ICON_GROUPS.map((g) => (
          <div key={g.name}>
            <H3 aside={<span className="tnum text-xs text-muted">{g.icons.length} biểu tượng</span>}>{g.name}</H3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
              {g.icons.map((n) => (
                <li key={n} className="flex min-w-0 flex-col items-center gap-1.5 rounded-sm border border-line bg-panel px-1 py-3">
                  <Icon name={n} size={24} className="text-ink" />
                  <span className="id-tag w-full break-all text-center text-[11px] leading-tight text-muted">{n}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <H3 className="mt-10">Logo</H3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-wrap items-end gap-6 rounded border border-line bg-paper p-5">
          <Wordmark sub="Hệ thống thiết kế" />
          <ReMark size={40} />
          <ReMark size={24} />
          <ReMark size={40} tone="ink" />
        </div>
        <div className="on-dark flex min-w-0 flex-wrap items-end gap-6 rounded bg-ink p-5">
          <Wordmark tone="paper" sub="RE Hub" />
          <ReMark size={40} tone="paper" />
          <ReMark size={24} tone="paper" />
        </div>
      </div>
      <p className="mt-3 max-w-[70ch] text-xs text-muted">
        Logo là mặt đứng của trạm theo đúng tỉ lệ 4 : 9 (800 × 1.800 mm), với màn hình và khe nhận ở đúng cao độ. Khe nhận màu lime là điểm nhấn duy nhất; không đổi màu, không thêm hiệu ứng.
      </p>
    </>
  );
}

function Buttons() {
  const [saving, setSaving] = useState(false);
  const variants: { v: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet'; label: string; use: string }[] = [
    { v: 'primary', label: 'Lên lịch thu gom', use: 'Hành động chính, một nút mỗi màn hình' },
    { v: 'secondary', label: 'Xuất CSV', use: 'Hành động phụ' },
    { v: 'ghost', label: 'Xem chi tiết', use: 'Hành động nhẹ trong thẻ, bảng' },
    { v: 'danger', label: 'Dừng nhận', use: 'Thao tác khó hoàn tác; luôn qua hộp thoại xác nhận' },
    { v: 'quiet', label: 'Hủy', use: 'Đóng, hủy, nút chỉ có biểu tượng' },
  ];
  return (
    <>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3 xl:grid-cols-5">
        {variants.map((b) => (
          <li key={b.v} className="flex min-w-0 flex-col items-start gap-2">
            <Button variant={b.v}>{b.label}</Button>
            <span className="id-tag text-xs font-semibold text-ink">btn-{b.v}</span>
            <span className="text-xs text-muted">{b.use}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-6 divide-y divide-line border-y border-line">
        <Row label="Cỡ" hint="sm 32 · md 40 · lg 52 px">
          <Button variant="primary" size="sm">
            Nhỏ
          </Button>
          <Button variant="primary">Vừa</Button>
          <Button variant="primary" size="lg">
            Lớn
          </Button>
        </Row>
        <Row label="Có biểu tượng" hint="Biểu tượng trước nhãn; mũi tên sau nhãn">
          <Button icon="download">Xuất báo cáo</Button>
          <Button variant="primary" iconRight="arrowRight">
            Tiếp tục
          </Button>
          <Tip label="Làm mới dữ liệu">
            <button type="button" className="btn btn-quiet px-2.5" aria-label="Làm mới dữ liệu">
              <Icon name="refresh" size={18} />
            </button>
          </Tip>
        </Row>
        <Row label="Đang xử lý" hint="Giữ nguyên độ rộng, chặn bấm lặp">
          <Button
            variant="primary"
            icon="check"
            loading={saving}
            onClick={() => {
              setSaving(true);
              setTimeout(() => {
                setSaving(false);
                toast('Đã lưu (demo).');
              }, 1400);
            }}
          >
            {saving ? 'Đang lưu' : 'Lưu ngưỡng'}
          </Button>
          <Button loading>Đang đồng bộ</Button>
        </Row>
        <Row label="Vô hiệu" hint="Luôn kèm lý do bên cạnh">
          <Button variant="primary" disabled aria-describedby="ds-btn-why">
            Xác nhận đã thu gom
          </Button>
          <span id="ds-btn-why" className="text-xs text-muted">
            Chưa quét mã thùng.
          </span>
        </Row>
      </dl>
      <p className="mt-3 max-w-[70ch] text-xs text-muted">
        Nút cao 40 px; trên thiết bị cảm ứng (<span className="id-tag">pointer: coarse</span>) nút cỡ vừa và nhỏ cao tối thiểu 44 px. Nhãn là động từ cụ thể, không dùng “OK” hay “Gửi”.
      </p>
    </>
  );
}

function Forms() {
  const [name, setName] = useState('Thư viện trung tâm');
  const [warn, setWarn] = useState(80);
  const [stop, setStop] = useState(120);
  const [zone, setZone] = useState<'all' | 'lecture' | 'dorm' | 'library'>('all');
  const [range, setRange] = useState<'today' | '7d' | '30d'>('7d');
  const [notify, setNotify] = useState(true);
  const [q, setQ] = useState('');
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="grid min-w-0 gap-x-6 gap-y-5 sm:grid-cols-2">
        <TextField id="ds-name" label="Tên trạm" value={name} onChange={setName} hint="Hiện trên ứng dụng và RE Hub." />
        <SelectField
          id="ds-zone"
          label="Khu vực"
          value={zone}
          onChange={setZone}
          options={[
            { value: 'all', label: 'Tất cả khu vực' },
            { value: 'lecture', label: 'Khu giảng đường' },
            { value: 'dorm', label: 'Khu ký túc xá' },
            { value: 'library', label: 'Khu thư viện' },
          ]}
        />
        <NumberField id="ds-warn" label="Ngưỡng cảnh báo thu gom" unit="%" value={warn} onChange={setWarn} min={0} max={100} hint="Mặc định 80 %." />
        <NumberField
          id="ds-stop"
          label="Ngưỡng dừng nhận"
          unit="%"
          value={stop}
          onChange={setStop}
          min={0}
          max={100}
          error={stop < 0 || stop > 100 ? 'Giá trị từ 0 đến 100.' : undefined}
        />
        <div className="min-w-0 sm:col-span-2">
          <Segmented
            label="Khoảng thời gian"
            name="ds-range"
            value={range}
            onChange={setRange}
            options={[
              { value: 'today', label: 'Hôm nay' },
              { value: '7d', label: '7 ngày' },
              { value: '30d', label: '30 ngày' },
            ]}
          />
        </div>
        <div className="min-w-0">
          <span className="field-label" aria-hidden>
            Tìm trạm
          </span>
          <SearchField id="ds-search" label="Tìm trạm" value={q} onChange={setQ} placeholder="Mã trạm hoặc địa điểm" />
        </div>
        <NumberField id="ds-points" label="Điểm mỗi chai (minh họa)" value={10} onChange={() => undefined} disabled hint="Chỉ quản trị viên chỉnh được. Điểm không quy đổi thành tiền." />
        <div className="min-w-0 rounded border border-line bg-panel p-3.5 sm:col-span-2">
          <Switch id="ds-notify" label="Báo khi trạm đạt ngưỡng cảnh báo" hint="Gửi tới người phụ trách tuyến." checked={notify} onChange={setNotify} />
        </div>
      </div>
      <Rules
        className="self-start"
        items={[
          'Nhãn luôn hiện phía trên ô; placeholder chỉ là ví dụ.',
          'Đơn vị nằm trong nhãn (%, kg), không gõ vào ô.',
          'Lỗi nói cách sửa, nằm ngay dưới ô, có biểu tượng và aria-invalid.',
          'Ô vô hiệu luôn kèm lý do.',
          'Ô nhập cao 40 px, 44 px trên màn hình cảm ứng.',
        ]}
      />
    </div>
  );
}

function Badges() {
  const tones: { tone: Tone; label: string; icon?: IconName }[] = [
    { tone: 'neutral', label: 'Nháp' },
    { tone: 'forest', label: 'Đã xác nhận', icon: 'check' },
    { tone: 'lime', label: 'Đã cộng điểm', icon: 'gift' },
    { tone: 'amber', label: 'Chờ phiếu cân', icon: 'alert' },
    { tone: 'fault', label: 'Thiếu chứng từ', icon: 'fileMissing' },
    { tone: 'slate', label: 'Chưa đồng bộ', icon: 'sync' },
    { tone: 'info', label: 'Đề xuất', icon: 'info' },
  ];
  return (
    <>
      <dl className="divide-y divide-line border-y border-line">
        <Row label="Trạng thái vận hành" hint="OpBadge, nhãn đầy đủ">
          {OPS.map((o) => (
            <OpBadge key={o} op={o} />
          ))}
        </Row>
        <Row label="Rút gọn" hint="Trong bảng và thẻ hẹp">
          {OPS.map((o) => (
            <OpBadge key={o} op={o} short />
          ))}
        </Row>
        <Row label="Số đo cũ" hint="Trạng thái cuối đã biết">
          <OpBadge op="warning" stale />
          <StaleTag />
          <StaleTag>Lần cuối 14:32</StaleTag>
        </Row>
        <Row label="Kết nối" hint="ConnBadge">
          <ConnBadge online />
          <ConnBadge online={false} minutes={27} />
        </Row>
        <Row label="Nguồn số liệu">
          <EstimateTag />
          <DemoTag />
          <Badge tone="slate" icon="sparkle">
            Dự phóng
          </Badge>
        </Row>
        <Row label="Badge chung" hint="Tone; nhãn chữ mang nghĩa">
          {tones.map((t) => (
            <Badge key={t.tone} tone={t.tone} icon={t.icon}>
              {t.label}
            </Badge>
          ))}
        </Row>
      </dl>

      <div className="card mt-6 p-4 sm:p-5">
        <H3>Ngưỡng mức đầy</H3>
        <div className="relative mt-7 pb-6" aria-hidden>
          <div className="flex h-3 overflow-hidden rounded-sm">
            <div className="w-[80%] bg-forest" />
            <div className="w-[15%] bg-amber" />
            <div className="w-[5%] bg-fault" />
          </div>
          {[
            { at: 80, label: '80 %' },
            { at: 95, label: '95 %' },
          ].map((t) => (
            <span key={t.at} className="absolute -top-6 flex -translate-x-1/2 flex-col items-center" style={{ left: `${t.at}%` }}>
              <span className="tnum text-xs font-semibold text-ink">{t.label}</span>
              <span className="mt-0.5 h-[18px] w-0.5 bg-ink" />
            </span>
          ))}
          <span className="tnum absolute bottom-0 left-0 text-xs text-muted">0 %</span>
          <span className="tnum absolute bottom-0 right-0 text-xs text-muted">100 %</span>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          <li className="flex min-w-0 flex-col items-start gap-1.5">
            <OpBadge op="accepting" />
            <span className="text-sm text-ink-2">Dưới 80 %: trạm nhận chai bình thường.</span>
          </li>
          <li className="flex min-w-0 flex-col items-start gap-1.5">
            <OpBadge op="warning" />
            <span className="text-sm text-ink-2">Từ 80 %: cảnh báo thu gom. RE Hub đưa trạm vào danh sách cần thu gom.</span>
          </li>
          <li className="flex min-w-0 flex-col items-start gap-1.5">
            <OpBadge op="stopped" />
            <span className="text-sm text-ink-2">Từ 95 %: dừng nhận. Màn hình báo tạm ngừng và không hiện mã QR.</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-muted">Giá trị mặc định, chỉnh được trong cài đặt. Kẹt rulo và dừng khẩn cấp dùng cùng màu với dừng nhận nhưng có nhãn riêng.</p>
      </div>
    </>
  );
}

function Metrics() {
  const meters: { id: string; pct: number; op: OpStatus }[] = [
    { id: 'RE-001', pct: 42, op: 'accepting' },
    { id: 'RE-002', pct: 84, op: 'warning' },
    { id: 'RE-003', pct: 97, op: 'stopped' },
  ];
  return (
    <>
      <div className="grid gap-6 rounded border border-line bg-panel p-5 sm:grid-cols-3">
        <Metric label="Chai được nhận" value={n0(1284)} unit="chai" icon="bottle" sub="Đếm tại trạm, sau xác nhận vào thùng" />
        <Metric
          label="Khối lượng"
          value={n1(28.2)}
          unit="kg"
          icon="scale"
          sub={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <EstimateTag /> 22 g/chai, giả định
            </span>
          }
        />
        <Metric label="Điểm đã cộng" value={n0(12840)} unit="điểm" icon="gift" sub="Không quy đổi thành tiền" />
      </div>
      <div className="mt-4 grid gap-6 rounded border border-line bg-panel p-5 sm:grid-cols-3">
        <Metric label="Đã dừng nhận" value="1" unit="trạm" icon="stop" tone="fault" size="sm" sub="RE-003 · 97 %" />
        <Metric label="Cần thu gom" value="1" unit="trạm" icon="alert" tone="amber" size="sm" sub="RE-002 · 84 %" />
        <Metric label="Mất kết nối" value="1" unit="trạm" icon="wifiOff" tone="slate" size="sm" sub="RE-004 · 27 phút" />
      </div>
      <Rules
        className="mt-4"
        items={[
          'Chai, kg và điểm là ba con số riêng, mỗi con số một đơn vị. Không gộp, không quy đổi chai thành điểm trong cùng một ô.',
          'Khối lượng suy từ số chai luôn có nhãn Ước tính; khối lượng cân tại điểm tiếp nhận đứng riêng.',
          'Chỉ số có màu khi đòi hành động, và luôn kèm biểu tượng cùng nhãn.',
        ]}
      />

      <H3 className="mt-8">Thanh mức đầy</H3>
      <ul className="flex flex-col gap-3 rounded border border-line bg-panel p-4 sm:p-5">
        {meters.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="id-tag w-16 shrink-0 text-sm font-semibold text-ink">{m.id}</span>
            <span className="w-36 shrink-0">
              <OpBadge op={m.op} short />
            </span>
            <div className="min-w-[180px] flex-1">
              <FillMeter pct={m.pct} label={`Mức đầy ${m.id}`} />
            </div>
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
          <span className="id-tag w-16 shrink-0 text-sm font-semibold text-slate">RE-004</span>
          <span className="w-36 shrink-0">
            <OpBadge op="accepting" stale short />
          </span>
          <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
            <FillMeter pct={63} stale label="Mức đầy RE-004" />
            <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <StaleTag /> lần cuối 14:32
            </span>
          </div>
        </li>
      </ul>
      <p className="mt-3 max-w-[70ch] text-xs text-muted">Vạch 80 % và 95 % luôn hiện trên thanh. Số % đứng cạnh thanh bằng chữ số đều. Số đo cũ được gạch chéo, chuyển sang slate và ghi thời điểm.</p>
    </>
  );
}

function TableAndFilters() {
  const [q, setQ] = useState('');
  const [conn, setConn] = useState<'all' | 'online' | 'offline'>('all');
  const [scope, setScope] = useState<'all' | 'attention'>('all');
  const rows = ROWS.filter((r) => {
    if (q && !fold(`${r.id} ${r.name}`).includes(fold(q.trim()))) return false;
    if (conn === 'online' && !r.online) return false;
    if (conn === 'offline' && r.online) return false;
    if (scope === 'attention' && r.op === 'accepting' && r.online) return false;
    return true;
  });
  const reset = () => {
    setQ('');
    setConn('all');
    setScope('all');
  };
  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px] md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-end">
        <SearchField id="ds-t-search" label="Tìm trạm" value={q} onChange={setQ} placeholder="Tìm mã hoặc tên trạm" />
        <SelectField
          id="ds-t-conn"
          label="Kết nối"
          hideLabel
          value={conn}
          onChange={setConn}
          options={[
            { value: 'all', label: 'Mọi kết nối' },
            { value: 'online', label: 'Trực tuyến' },
            { value: 'offline', label: 'Mất kết nối' },
          ]}
        />
        <Segmented
          label="Phạm vi"
          hideLabel
          name="ds-t-scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'attention', label: 'Cần xử lý' },
          ]}
        />
      </div>
      <p className="mb-2 text-xs text-muted" aria-live="polite">
        Hiển thị <span className="tnum">{rows.length}</span>/<span className="tnum">{ROWS.length}</span> trạm · sắp xếp theo mức ưu tiên
      </p>
      <div className="overflow-x-auto rounded border border-line bg-panel scroll-thin">
        <table className="table-base min-w-[720px]">
          <caption className="sr-only">Trạm thu gom (dữ liệu demo)</caption>
          <thead>
            <tr>
              <th scope="col">Trạm</th>
              <th scope="col">Trạng thái</th>
              <th scope="col" className="w-[210px]">
                Mức đầy
              </th>
              <th scope="col">Kết nối</th>
              <th scope="col" className="text-right">
                Cập nhật
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="id-tag font-semibold text-ink">{r.id}</span>
                  <span className="block text-xs text-muted">{r.name}</span>
                </td>
                <td>
                  <OpBadge op={r.op} stale={!r.online} short />
                </td>
                <td>
                  <FillMeter pct={r.pct} stale={!r.online} size="sm" label={`Mức đầy ${r.id}`} />
                </td>
                <td>
                  <ConnBadge online={r.online} minutes={r.offMin} />
                </td>
                <td className="text-right">
                  <span className={`tnum ${r.online ? 'text-ink' : 'text-slate'}`}>{r.at}</span>
                  {!r.online && (
                    <span className="mt-0.5 flex justify-end">
                      <StaleTag />
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="py-4 text-center text-sm text-muted">
                    Không có trạm khớp bộ lọc.{' '}
                    <button type="button" className="link" onClick={reset}>
                      Xóa bộ lọc
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-[70ch] text-xs text-muted">
        Bảng nằm trong vùng cuộn ngang riêng, trang không bao giờ cuộn ngang. Cột số căn phải; mã dùng <span className="id-tag">.id-tag</span>. Trên điện thoại, RE Hub chuyển bảng thành thẻ.
      </p>
    </>
  );
}

function Overlays() {
  const [drawer, setDrawer] = useState(false);
  const [dialog, setDialog] = useState(false);
  return (
    <>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="min-w-0">
          <H3>Ngăn kéo và hộp thoại</H3>
          <div className="flex flex-wrap gap-2">
            <Button icon="layers" onClick={() => setDrawer(true)}>
              Mở ngăn kéo
            </Button>
            <Button variant="danger" icon="stop" onClick={() => setDialog(true)}>
              Mở hộp thoại xác nhận
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Ngăn kéo cho chi tiết bên cạnh danh sách. Hộp thoại chỉ để xác nhận thao tác khó hoàn tác. Cả hai giữ focus bên trong, đóng bằng Esc và trả focus về nút đã mở.</p>
        </div>
        <div className="min-w-0">
          <H3>Toast</H3>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon="checkCircle" onClick={() => toast('Đã lưu ngưỡng cảnh báo.')}>
              Toast thành công
            </Button>
            <Button size="sm" icon="info" onClick={() => toast('Đã sao chép mã lô LO-0002.', 'info')}>
              Toast thông tin
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">Tối đa ba toast cùng lúc, tự ẩn sau khoảng 4 giây, đọc qua vùng aria-live lịch sự.</p>
        </div>
      </div>

      <H3 className="mt-8">Banner</H3>
      <div className="flex flex-col gap-3">
        <Alert tone="info" title="Ngưỡng mới chờ đồng bộ">
          Trạm nhận ngưỡng 80 % / 95 % ở lần đồng bộ tiếp theo.
        </Alert>
        <Alert
          tone="warn"
          title="RE-002 cần thu gom (84 %)."
          actions={
            <Button size="sm" icon="route">
              Thêm vào tuyến
            </Button>
          }
        >
          Thêm vào tuyến thu gom tiếp theo trước khi trạm chạm 95 %.
        </Alert>
        <Alert
          tone="stop"
          title="RE-003 đã dừng nhận (96 %)."
          actions={
            <Button size="sm" variant="primary" icon="calendar">
              Lên lịch thu gom
            </Button>
          }
        >
          Lên lịch thu gom để trạm nhận chai trở lại.
        </Alert>
        <Alert tone="stale" title="RE-004 mất kết nối 27 phút.">
          Mức đầy 63 % là số đo lúc 14:32, không phải số hiện tại.
        </Alert>
        <Alert tone="success" title="Đã đổi thùng tại RE-003.">
          Trạm nhận chai trở lại.
        </Alert>
      </div>
      <Rules
        className="mt-4"
        items={[
          'Banner cho vấn đề vận hành chưa xử lý: nằm yên đến khi trạng thái thay đổi, không tự biến mất.',
          'Toast chỉ cho xác nhận ngắn sau một thao tác (đã lưu, đã sao chép). Không dùng toast cho lỗi hay cảnh báo cần xử lý.',
          'Banner dừng nhận xuất hiện trong lúc dùng có role="alert"; các banner khác có role="status".',
        ]}
      />

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title={
          <span className="flex items-center gap-2">
            <span className="id-tag">RE-003</span> Thư viện trung tâm
          </span>
        }
        footer={
          <>
            <Button onClick={() => setDrawer(false)}>Đóng</Button>
            <Button
              variant="primary"
              icon="calendar"
              onClick={() => {
                setDrawer(false);
                toast('Đã thêm RE-003 vào tuyến thu gom (demo).');
              }}
            >
              Lên lịch thu gom
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <OpBadge op="stopped" />
            <ConnBadge online />
            <DemoTag />
          </div>
          <FillMeter pct={96} label="Mức đầy RE-003" />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Đồng bộ lần cuối</dt>
            <dd className="tnum text-ink">14:58</dd>
            <dt className="text-muted">Khối lượng trong thùng</dt>
            <dd className="flex flex-wrap items-center gap-1.5 text-ink">
              <span className="tnum">{n1(6.9)} kg</span> <EstimateTag />
            </dd>
          </dl>
          <Alert tone="stop">RE-003 đã dừng nhận (96 %). Lên lịch thu gom.</Alert>
        </div>
      </Drawer>
      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        tone="stop"
        title="Dừng nhận tại RE-001?"
        footer={
          <>
            <Button onClick={() => setDialog(false)}>Hủy</Button>
            <Button
              variant="danger"
              icon="stop"
              onClick={() => {
                setDialog(false);
                toast('Đã gửi lệnh dừng nhận tới RE-001 (demo).');
              }}
            >
              Dừng nhận
            </Button>
          </>
        }
      >
        Màn hình trạm sẽ báo tạm ngừng và không hiện mã QR cho tới khi bạn mở lại.
      </Dialog>
    </>
  );
}

function Charts() {
  const latest = DAILY[DAILY.length - 1];
  return (
    <>
      <div className="card min-w-0 p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Khối lượng mỗi ngày, 14 ngày</h3>
            <p className="text-xs text-muted">
              Hôm nay <span className="tnum font-semibold text-ink">{n1(latest.kg)} kg</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EstimateTag />
            <DemoTag />
            <Tip label="Rê chuột hoặc chạm vào cột để xem giá trị">
              <button type="button" className="btn btn-quiet btn-sm px-2" aria-label="Cách đọc biểu đồ">
                <Icon name="info" size={16} />
              </button>
            </Tip>
          </div>
        </div>
        <DailyBars data={DAILY} label="Khối lượng ước tính mỗi ngày trong 14 ngày, dữ liệu demo" />
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card min-w-0 p-4 sm:p-5">
          <H3 aside={<DemoTag />}>Chai theo trạm</H3>
          <Breakdown
            unit="chai"
            items={[
              { label: 'RE-001', value: 512, color: 'rgb(var(--c-forest))' },
              { label: 'RE-002', value: 438, color: 'rgb(var(--c-forest) / 0.6)' },
              { label: 'RE-003', value: 334, color: 'rgb(var(--c-forest) / 0.3)' },
            ]}
          />
        </div>
        <Rules
          className="self-start"
          items={[
            'Một thang tuyến tính bắt đầu từ 0; không hai trục, không 3D.',
            'Cột mới nhất tô đậm, các cột trước nhạt hơn.',
            'Giá trị nằm trong tooltip và thẻ title của từng cột; số chính xác nằm ở bảng bên cạnh.',
            'Phân rã dùng các sắc độ của forest theo thứ tự lớn đến nhỏ, kèm bảng số và %.',
            'Biểu đồ khối lượng ghi rõ Ước tính khi số liệu suy từ số chai.',
          ]}
        />
      </div>
    </>
  );
}

function Navigation() {
  const [tab, setTab] = useState<'all' | 'attention' | 'synced'>('attention');
  const [hub, setHub] = useState('stations');
  const [app, setApp] = useState('home');
  const hubItems: { id: string; label: string; icon: IconName }[] = [
    { id: 'overview', label: 'Tổng quan', icon: 'grid' },
    { id: 'stations', label: 'Trạm thu gom', icon: 'station' },
    { id: 'routes', label: 'Tuyến thu gom', icon: 'route' },
    { id: 'tx', label: 'Giao dịch', icon: 'list' },
    { id: 'trace', label: 'Truy xuất & báo cáo', icon: 'file' },
    { id: 'settings', label: 'Cài đặt', icon: 'settings' },
  ];
  const appItems: { id: string; label: string; icon: IconName }[] = [
    { id: 'home', label: 'Trang chủ', icon: 'home' },
    { id: 'stations', label: 'Trạm', icon: 'mapPin' },
    { id: 'return', label: 'Trả chai', icon: 'bottle' },
    { id: 'history', label: 'Lịch sử', icon: 'history' },
    { id: 'points', label: 'Điểm', icon: 'gift' },
  ];
  const panel: Record<typeof tab, string> = {
    all: 'Mọi trạm, sắp xếp theo mức ưu tiên.',
    attention: 'Trạm dừng nhận, mất kết nối hoặc cần thu gom.',
    synced: 'Trạm đã đồng bộ trong 15 phút gần nhất.',
  };
  return (
    <>
      <H3 aside={<DemoTag />}>Tab</H3>
      <Tabs
        label="Lọc trạm"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'all', label: 'Tất cả', count: 4 },
          { value: 'attention', label: 'Cần xử lý', count: 3 },
          { value: 'synced', label: 'Đã đồng bộ', count: 3 },
        ]}
      />
      <div role="tabpanel" aria-label="Nội dung tab" className="py-3 text-sm text-ink-2">
        {panel[tab]}
      </div>
      <p className="text-xs text-muted">Phím mũi tên trái/phải chuyển tab. Số đếm nằm trong tab, không thay cho nhãn.</p>

      <div className="mt-8 grid gap-8 md:grid-cols-[240px_minmax(0,1fr)]">
        <div className="min-w-0">
          <H3>Thanh bên RE Hub</H3>
          <nav aria-label="Mẫu thanh bên RE Hub" className="w-full max-w-[240px] rounded border border-line bg-panel p-3">
            <div className="mb-3 px-1">
              <Wordmark sub="RE Hub" size={24} />
            </div>
            <ul className="flex flex-col gap-0.5">
              {hubItems.map((it) => {
                const active = hub === it.id;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => setHub(it.id)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-[40px] w-full items-center gap-2.5 rounded px-3 text-left text-sm font-medium transition-colors ${
                        active ? 'bg-forest text-white' : 'text-ink hover:bg-sunk'
                      }`}
                    >
                      <Icon name={it.icon} size={18} />
                      <span className="min-w-0">{it.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className="mt-2 text-xs text-muted">240 px từ 1024 px trở lên; thu gọn ở máy tính bảng.</p>
        </div>
        <div className="min-w-0">
          <H3>Thanh tab ứng dụng</H3>
          <div className="mx-auto w-full max-w-[390px] overflow-hidden rounded-lg border border-line bg-paper md:mx-0">
            <div className="flex h-28 flex-col gap-2 p-4" aria-hidden>
              <div className="h-3 w-2/5 rounded-sm bg-sunk" />
              <div className="h-3 w-4/5 rounded-sm bg-sunk" />
              <div className="h-3 w-3/5 rounded-sm bg-sunk" />
            </div>
            <nav aria-label="Mẫu thanh tab ứng dụng" className="grid grid-cols-5 border-t border-line bg-white">
              {appItems.map((t) => {
                const active = app === t.id;
                const primary = t.id === 'return';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setApp(t.id)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex min-h-[56px] min-w-0 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-forest' : 'text-muted hover:text-ink'}`}
                  >
                    {primary ? (
                      <span className={`-mt-1 grid h-9 w-9 place-items-center rounded-full ${active ? 'bg-forest-ink' : 'bg-forest'} text-white shadow-1`}>
                        <Icon name={t.icon} size={19} />
                      </span>
                    ) : (
                      <Icon name={t.icon} size={21} strokeWidth={active ? 2.1 : 1.75} />
                    )}
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <p className="mt-2 text-xs text-muted">Năm mục, cao 56 px, có nhãn chữ. Trả chai là hành động chính nên nằm giữa; thanh ẩn trong lúc trả chai.</p>
        </div>
      </div>
    </>
  );
}

function StateCard({ title, rule, children }: { title: string; rule: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded border border-line bg-panel p-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-0.5 text-xs text-muted">{rule}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function States() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <StateCard title="Đang tải" rule="Giữ đúng hình dạng nội dung sắp hiện; không chặn cả trang bằng vòng quay.">
        <div role="status" className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-4 w-14" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
          <span className="sr-only">Đang tải danh sách trạm</span>
        </div>
      </StateCard>
      <StateCard title="Trống" rule="Nói vì sao trống và bước tiếp theo.">
        <EmptyState
          icon="route"
          title="Chưa có tuyến hôm nay"
          action={
            <Button size="sm" icon="plus">
              Tạo tuyến
            </Button>
          }
        >
          Trạm đạt 80 % sẽ tự vào danh sách cần thu gom.
        </EmptyState>
      </StateCard>
      <StateCard title="Lỗi" rule="Nói điều gì hỏng, hậu quả và cách sửa; có nút thử lại.">
        <Alert
          tone="stop"
          title="Không tải được giao dịch."
          actions={
            <Button size="sm" icon="refresh">
              Thử lại
            </Button>
          }
        >
          Dữ liệu đã đồng bộ không bị mất.
        </Alert>
      </StateCard>
      <StateCard title="Mất kết nối" rule="Giữ số đo cuối, ghi rõ từ lúc nào; không đoán giá trị hiện tại.">
        <div className="flex flex-col items-start gap-2.5">
          <ConnBadge online={false} minutes={27} />
          <Alert tone="stale" title="RE-004 mất kết nối từ 14:32.">
            Thao tác cần trạm xác nhận sẽ chờ đến khi kết nối lại.
          </Alert>
        </div>
      </StateCard>
      <StateCard title="Số đo cũ" rule="Gạch chéo, màu slate và thời điểm; không dùng màu cảnh báo cho số đo cũ.">
        <div className="flex flex-col gap-2">
          <FillMeter pct={63} stale label="Mức đầy RE-004" />
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <StaleTag /> lần cuối 14:32
          </span>
        </div>
      </StateCard>
      <StateCard title="Vô hiệu" rule="Luôn ghi lý do ngay cạnh thao tác bị khóa.">
        <div className="flex flex-col items-start gap-2">
          <Button variant="primary" disabled aria-describedby="ds-state-why" icon="check">
            Xác nhận đã xử lý
          </Button>
          <p id="ds-state-why" className="flex gap-1.5 text-xs text-ink-2">
            <Icon name="wifiOff" size={14} className="mt-px text-slate" />
            Trạm đang mất kết nối, chưa thể xác nhận đã xử lý.
          </p>
        </div>
      </StateCard>
      <StateCard title="Thành công" rule="Xác nhận kết quả cụ thể. Nếu chỉ là thao tác ngắn, dùng toast.">
        <Alert tone="success" title="Đã đổi thùng tại RE-003.">
          Trạm nhận chai trở lại.
        </Alert>
      </StateCard>
    </div>
  );
}

function Accessibility({ reduced }: { reduced: boolean }) {
  const [op, setOp] = useState<OpStatus>('accepting');
  const next: Record<OpStatus, OpStatus> = { accepting: 'warning', warning: 'stopped', stopped: 'accepting', jam: 'accepting', estop: 'accepting' };
  return (
    <div className="grid gap-x-8 gap-y-8 md:grid-cols-2">
      <div className="min-w-0">
        <H3>Vòng focus</H3>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Nhấn Tab tới đây</Button>
          <span className="btn btn-secondary pointer-events-none outline outline-2 outline-offset-2 outline-forest" aria-hidden>
            Mẫu khi có focus
          </span>
        </div>
        <p className="mt-2 text-sm text-ink-2">Viền 2 px màu forest, cách 2 px ({n2(7.72)}:1 trên nền paper); trên nền tối dùng lime. Chỉ hiện khi dùng bàn phím.</p>
      </div>
      <div className="min-w-0">
        <H3>Vùng chạm 44 px</H3>
        <div className="flex items-center gap-4">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-sm border border-dashed border-forest bg-forest-tint/60" aria-hidden>
            <Icon name="x" size={20} className="text-ink" />
          </span>
          <span className="tnum text-xs text-muted">44 × 44 px vùng chạm · 20 px biểu tượng</span>
        </div>
        <p className="mt-2 text-sm text-ink-2">Trên thiết bị cảm ứng, nút và ô nhập cao tối thiểu 44 px; thanh tab 56 px. Biểu tượng nhỏ vẫn có vùng chạm đủ lớn.</p>
      </div>
      <div className="min-w-0">
        <H3>Giảm chuyển động</H3>
        <Badge tone={reduced ? 'forest' : 'neutral'} icon={reduced ? 'check' : 'info'}>
          {reduced ? 'Trình duyệt này đang bật giảm chuyển động' : 'Trình duyệt này không bật giảm chuyển động'}
        </Badge>
        <p className="mt-2 text-sm text-ink-2">
          Tôn trọng <span className="id-tag text-xs">prefers-reduced-motion</span>: tắt hoạt ảnh (rulo, vạch quét, skeleton, ngăn kéo) và cuộn không mượt. Không có thông tin nào chỉ truyền qua chuyển động.
        </p>
      </div>
      <div className="min-w-0">
        <H3>Không chỉ dựa vào màu</H3>
        <div className="flex flex-wrap gap-2 grayscale" aria-hidden>
          <OpBadge op="accepting" short />
          <OpBadge op="warning" short />
          <OpBadge op="stopped" short />
          <OpBadge op="accepting" stale short />
        </div>
        <p className="mt-2 text-sm text-ink-2">Ở đen trắng, bốn trạng thái vẫn phân biệt được nhờ biểu tượng và nhãn. Số đo cũ thêm gạch chéo và thời điểm.</p>
      </div>
      <div className="min-w-0">
        <H3>Ngôn ngữ và định dạng</H3>
        <p className="text-sm text-ink-2">
          Trang khai báo <span className="id-tag text-xs">lang="vi"</span> để trình đọc màn hình đọc đúng dấu. Số, ngày, giờ theo vi-VN:{' '}
          <span className="tnum font-semibold text-ink">
            {n0(1284)} · {n1(96.4)} % · 14:32 · 10/10
          </span>
          .
        </p>
      </div>
      <div className="min-w-0">
        <H3>Thông báo khi trạng thái đổi</H3>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" icon="sync" onClick={() => setOp((o) => next[o])}>
            Mô phỏng thay đổi
          </Button>
          <div role="status" className="flex items-center gap-2 text-sm">
            <span className="id-tag font-semibold text-ink">RE-002</span>
            <OpBadge op={op} />
          </div>
        </div>
        <p className="mt-2 text-sm text-ink-2">Trạng thái trạm nằm trong vùng aria-live; trình đọc màn hình thông báo khi đổi mà không chuyển focus. Dừng nhận dùng role="alert".</p>
      </div>
    </div>
  );
}

function Responsive() {
  return (
    <>
      <div className="overflow-x-auto rounded border border-line bg-panel scroll-thin">
        <table className="table-base min-w-[760px]">
          <caption className="sr-only">Thứ bậc nội dung theo cỡ màn hình</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[150px]">
                Sản phẩm
              </th>
              <th scope="col">
                <span className="tnum">1440</span> · máy tính
              </th>
              <th scope="col">
                <span className="tnum">834</span> · máy tính bảng
              </th>
              <th scope="col">
                <span className="tnum">390</span> · điện thoại
              </th>
            </tr>
          </thead>
          <tbody>
            {RESPONSIVE.map((r) => (
              <tr key={r.product}>
                <th scope="row" className="!align-top">
                  {r.product}
                </th>
                <td className="!align-top text-ink-2">{r.d}</td>
                <td className="!align-top text-ink-2">{r.t}</td>
                <td className="!align-top text-ink-2">{r.m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Rules
        className="mt-4"
        items={[
          'Màn hình càng nhỏ, việc cần làm ngay càng lên cao: cảnh báo trước, số liệu tổng sau.',
          'Không ẩn trạng thái vận hành ở màn hình nhỏ; chỉ ẩn bớt cột phụ.',
          'Không có cuộn ngang ở cấp trang; bảng và biểu đồ rộng cuộn trong vùng riêng.',
        ]}
      />
    </>
  );
}

/* ---------- Page ---------- */

export function DesignSystem() {
  const reduced = useReducedMotion();
  const [active, setActive] = useActiveSection();
  const rowRef = useRef<HTMLUListElement>(null);

  // In-page links must not touch location.hash: the app routes on it and #design is this page.
  const go = (id: SectionId) => (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const sec = document.getElementById(id);
    if (!sec) return;
    sec.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    sec.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
    setActive(id);
  };

  useEffect(() => {
    const row = rowRef.current;
    const el = row?.querySelector<HTMLElement>(`[data-id="${active}"]`);
    if (!row || !el || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: el.offsetLeft - 16, behavior: reduced ? 'auto' : 'smooth' });
  }, [active, reduced]);

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <div className="mx-auto max-w-content px-4 pb-20 pt-6 sm:px-6 md:pt-10">
        <header className="pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Wordmark sub="Hệ thống thiết kế" />
            <span className="flex flex-wrap items-center gap-2">
              <DemoTag>Bản đề xuất</DemoTag>
              <span className="tnum text-xs text-muted">{SECTIONS.length} mục</span>
            </span>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-ink">Thành phần và quy tắc giao diện</h1>
          <p className="mt-1.5 max-w-[72ch] text-ink-2">
            Một nguồn tham chiếu cho trang giới thiệu, ứng dụng trả chai, giao diện tài xế và RE Hub; mọi mẫu dưới đây là thành phần thật trong bản mẫu, số liệu mẫu là dữ liệu demo.
          </p>
        </header>

        <nav
          aria-label="Mục trong trang"
          className="sticky z-20 -mx-4 mb-8 border-y border-line bg-paper/95 sm:-mx-6 lg:hidden"
          style={{ top: 'calc(44px + env(safe-area-inset-top, 0px))' }}
        >
          <ul ref={rowRef} className="relative flex overflow-x-auto px-4 scroll-thin sm:px-6">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <li key={s.id} data-id={s.id} className="shrink-0">
                  <a
                    href="#design"
                    onClick={go(s.id)}
                    aria-current={on ? 'location' : undefined}
                    className={`-mb-px inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-[13px] font-medium transition-colors ${
                      on ? 'border-forest text-ink' : 'border-transparent text-muted hover:text-ink'
                    }`}
                  >
                    <span className="id-tag text-[10.5px] text-muted">{num(s.id)}</span>
                    {s.short}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Mục trong trang" className="sticky top-[68px] hidden max-h-[calc(100vh-92px)] self-start overflow-y-auto border-t border-line pt-3 scroll-thin lg:block">
            <ul className="flex flex-col gap-px">
              {SECTIONS.map((s) => {
                const on = active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href="#design"
                      onClick={go(s.id)}
                      aria-current={on ? 'location' : undefined}
                      className={`flex min-h-[32px] items-center gap-2.5 rounded-r-sm border-l-2 px-2.5 py-1 text-[13px] transition-colors [@media(pointer:coarse)]:min-h-[44px] ${
                        on ? 'border-forest bg-panel font-semibold text-ink' : 'border-transparent text-ink-2 hover:bg-sunk hover:text-ink'
                      }`}
                    >
                      <span className="id-tag w-5 shrink-0 text-[11px] font-normal text-muted">{num(s.id)}</span>
                      <span className="min-w-0">{s.title}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex min-w-0 flex-col gap-14">
            <Section id="ds-principles" intro="Sáu quy tắc áp dụng cho mọi màn hình RE. Khi một thành phần mâu thuẫn với chúng, sửa thành phần.">
              <Principles />
            </Section>
            <Section id="ds-color" intro="Giấy ấm, chữ than, xanh rừng cho hành động; lime chỉ là điểm nhấn nhỏ. Màu khai báo bằng biến CSS dạng “R G B” để Tailwind ghép độ trong suốt.">
              <Colors />
            </Section>
            <Section id="ds-type" intro="Một họ chữ cho toàn bộ giao diện, một họ chữ đơn cách cho mã. Tiêu đề vừa phải; thứ bậc đến từ độ đậm và khoảng trắng hơn là cỡ chữ.">
              <Typography />
            </Section>
            <Section id="ds-space">
              <Spacing />
            </Section>
            <Section id="ds-icons">
              <Icons />
            </Section>
            <Section id="ds-buttons">
              <Buttons />
            </Section>
            <Section id="ds-forms" intro="Các ô dưới đây hoạt động thật. Thử nhập ngưỡng dừng nhận trong khoảng 0–100 để xóa lỗi.">
              <Forms />
            </Section>
            <Section id="ds-badges" intro="Huy hiệu luôn có biểu tượng và nhãn. Màu chỉ củng cố, không mang nghĩa một mình.">
              <Badges />
            </Section>
            <Section id="ds-metrics" tools={<DemoTag />}>
              <Metrics />
            </Section>
            <Section id="ds-tables" tools={<DemoTag />} intro="Bộ lọc dưới đây lọc thật bốn hàng demo.">
              <TableAndFilters />
            </Section>
            <Section id="ds-overlays">
              <Overlays />
            </Section>
            <Section id="ds-charts">
              <Charts />
            </Section>
            <Section id="ds-nav">
              <Navigation />
            </Section>
            <Section id="ds-states" intro="Mỗi màn hình dữ liệu cần đủ bảy trạng thái này trước khi được coi là xong.">
              <States />
            </Section>
            <Section id="ds-a11y">
              <Accessibility reduced={reduced} />
            </Section>
            <Section id="ds-responsive">
              <Responsive />
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
