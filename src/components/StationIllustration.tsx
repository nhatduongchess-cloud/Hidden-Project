import type { Phase } from '../domain/deposit';
import type { FaultKind } from '../domain/types';

export type ZoneId = 'ui' | 'inspection' | 'flatten' | 'bin' | 'sensors';
export const ZONES: ZoneId[] = ['ui', 'inspection', 'flatten', 'bin', 'sensors'];

interface Props {
  view: 'exterior' | 'cutaway';
  phase: Phase;
  fillPct: number;
  warnPct: number;
  stopPct: number;
  fault: FaultKind | null;
  rejected: boolean;
  pointsShown: number | null;
  screenText: string;
  selectedZone?: ZoneId | null;
  onSelectZone?: (z: ZoneId) => void;
  zoneNames?: Record<ZoneId, string>;
  title: string;
  /** Hide dimension lines (compact live view). */
  compact?: boolean;
}

/** Gear outline for the toothed rollers. */
function gear(cx: number, cy: number, r: number, teeth: number): string {
  const pts: string[] = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r - 4;
    const a1 = a - Math.PI / (teeth * 4);
    const a2 = a + Math.PI / (teeth * 4);
    pts.push(`${cx + rr * Math.cos(a1)},${cy + rr * Math.sin(a1)}`, `${cx + rr * Math.cos(a2)},${cy + rr * Math.sin(a2)}`);
  }
  return pts.join(' ');
}

// Drawing scale: 1 unit = 2 mm. Enclosure 800 × 1800 mm → 400 × 900.
const H = 900;
const yFromFloor = (mm: number) => H - mm / 2;
const INTAKE_Y = yFromFloor(1125); // 337.5
const SCREEN_Y = yFromFloor(1320); // 240
const BIN = { x: 44, y: 486, w: 312, h: 344 };

/** Highlight areas and numbered markers per view. Rollers and sensors are only visible in the cutaway. */
const ZONE_AREAS: Record<'exterior' | 'cutaway', Partial<Record<ZoneId, [number, number, number, number][]>>> = {
  exterior: {
    ui: [[218, 150, 174, 216]],
    inspection: [[8, 270, 204, 136]],
    bin: [[8, 482, 384, 380]],
  },
  cutaway: {
    ui: [[230, 270, 140, 74]],
    inspection: [[50, 260, 166, 120]],
    flatten: [[76, 384, 172, 70]],
    bin: [[38, 480, 324, 356]],
    sensors: [[144, 458, 186, 22], [38, 838, 324, 24]],
  },
};
const MARKERS: Record<'exterior' | 'cutaway', Partial<Record<ZoneId, [number, number][]>>> = {
  exterior: { ui: [[392, 172]], inspection: [[200, 286]], bin: [[392, 520]] },
  cutaway: { ui: [[384, 284]], inspection: [[226, 270]], flatten: [[62, 414]], bin: [[372, 700]], sensors: [[350, 468], [376, 850]] },
};

const C = {
  ink: 'rgb(var(--c-ink))',
  steel: '#d8dad6',
  steelDark: '#b9bcb8',
  panel: '#eceeea',
  dark: '#4a4e4c',
  darker: '#343836',
  forest: 'rgb(var(--c-forest))',
  lime: 'rgb(var(--c-lime))',
  amber: 'rgb(var(--c-amber))',
  fault: 'rgb(var(--c-fault))',
  bin: '#5d7f99',
  binDark: '#46667e',
  pet: '#e9f2f5',
};

function statusColor(phase: Phase, fault: FaultKind | null, rejected: boolean): string {
  if (fault || phase === 'FAULT') return C.fault;
  if (phase === 'BLOCKED') return C.amber;
  if (phase === 'RETURNED' || (rejected && phase === 'INSPECTING')) return C.fault;
  if (['ACCEPTED', 'FLATTENING', 'DROP_CONFIRMED', 'POINTS_CREDITED'].includes(phase)) return C.lime;
  return C.forest;
}

export function StationIllustration(p: Props) {
  const col = statusColor(p.phase, p.fault, p.rejected);
  const doorOpen = ['USER_IDENTIFIED', 'BOTTLE_INSERTED', 'RETURNED'].includes(p.phase);
  const trapOpen = p.phase === 'ACCEPTED' || p.phase === 'FLATTENING';
  const spinning = p.phase === 'FLATTENING' && !p.fault;
  const jam = p.fault === 'jam';
  const scanning = p.phase === 'INSPECTING';
  const fill = Math.max(0, Math.min(100, p.fillPct));
  const fillH = (BIN.h - 8) * (fill / 100);
  const fillColor = fill >= p.stopPct ? C.fault : fill >= p.warnPct ? C.amber : C.forest;

  // Bottle position per phase (cutaway coordinates).
  let bottle: { x: number; y: number; r: number; sy: number; o: number } = { x: -90, y: INTAKE_Y, r: 0, sy: 1, o: 0 };
  switch (p.phase) {
    case 'BOTTLE_INSERTED':
    case 'DOOR_CLOSED':
    case 'INSPECTING':
    case 'ACCEPTED':
      bottle = { x: 128, y: INTAKE_Y + 8, r: 0, sy: 1, o: 1 };
      break;
    case 'RETURNED':
      bottle = { x: -40, y: INTAKE_Y, r: 0, sy: 1, o: 1 };
      break;
    case 'FLATTENING':
      bottle = { x: 130, y: 402, r: 90, sy: jam ? 0.8 : 0.35, o: 1 };
      break;
    case 'FAULT':
      bottle = { x: 130, y: 402, r: 90, sy: 0.6, o: 1 };
      break;
    case 'DROP_CONFIRMED':
      bottle = { x: 150, y: BIN.y + BIN.h - fillH - 22, r: 80, sy: 0.25, o: 1 };
      break;
    default:
      bottle = { x: -90, y: INTAKE_Y, r: 0, sy: 1, o: 0 };
  }
  const rejectedTint = p.phase === 'RETURNED';


  const Screen = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#1d2b25" stroke="#111" />
      <text x={x + w / 2} y={y + h * 0.36} textAnchor="middle" fontSize={11} fill="#cfe7d6" fontFamily="Be Vietnam Pro, sans-serif">
        {p.screenText.length > 22 ? p.screenText.slice(0, 21) + '…' : p.screenText}
      </text>
      {p.pointsShown !== null && (
        <text x={x + w / 2} y={y + h * 0.72} textAnchor="middle" fontSize={22} fontWeight={700} fill={C.lime} fontFamily="Be Vietnam Pro, sans-serif" className="rise">
          +{p.pointsShown}
        </text>
      )}
    </g>
  );

  return (
    <svg viewBox={p.compact ? '-8 -8 416 916' : '-70 -24 540 960'} role="img" aria-label={p.title} className="h-auto w-full max-w-full select-none">
      <title>{p.title}</title>
      {/* dimension lines */}
      <g display={p.compact ? 'none' : undefined} stroke={C.ink} strokeWidth={1} opacity={0.55} fontFamily="JetBrains Mono, monospace" fontSize={11} fill={C.ink}>
        <line x1={-36} y1={0} x2={-36} y2={H} />
        <line x1={-42} y1={0} x2={-30} y2={0} />
        <line x1={-42} y1={H} x2={-30} y2={H} />
        <text x={-46} y={H / 2} transform={`rotate(-90 -46 ${H / 2})`} textAnchor="middle" stroke="none">
          1.800 mm
        </text>
        <line x1={0} y1={H + 18} x2={400} y2={H + 18} />
        <text x={200} y={H + 32} textAnchor="middle" stroke="none">
          800 mm
        </text>
        <line x1={406} y1={INTAKE_Y} x2={420} y2={INTAKE_Y} />
        <text x={424} y={INTAKE_Y + 4} stroke="none">1.125</text>
        <line x1={406} y1={SCREEN_Y} x2={420} y2={SCREEN_Y} />
        <text x={424} y={SCREEN_Y + 4} stroke="none">1.320</text>
      </g>

      {p.view === 'exterior' ? (
        <g>
          <rect x={0} y={0} width={400} height={880} fill={C.steel} stroke={C.darker} strokeWidth={2} />
          <rect x={6} y={880} width={388} height={20} fill={C.darker} />
          <rect x={0} y={0} width={400} height={36} fill={C.dark} />
          <text x={200} y={24} textAnchor="middle" fontSize={14} fill="#f1f1ee" fontFamily="Be Vietnam Pro, sans-serif" fontWeight={600} letterSpacing="0.06em">
            RE · TRẠM THU HỒI CHAI PET
          </text>
          {/* left instruction panel */}
          <rect x={8} y={44} width={204} height={362} fill={C.panel} stroke={C.steelDark} />
          <text x={110} y={86} textAnchor="middle" fontSize={15} fontWeight={700} fill={C.darker} fontFamily="Be Vietnam Pro, sans-serif">
            CHAI PET RỖNG
          </text>
          {['1  Quét mã QR', '2  Đặt chai vào khe', '3  Chờ xác nhận'].map((t, i) => (
            <text key={t} x={30} y={124 + i * 22} fontSize={11.5} fill={C.dark} fontFamily="Be Vietnam Pro, sans-serif">
              {t}
            </text>
          ))}
          <rect x={52} y={INTAKE_Y - 58} width={116} height={6} rx={3} fill={col} className={p.phase === 'BLOCKED' || p.fault ? 'blink' : ''} />
          <circle cx={110} cy={INTAKE_Y} r={36} fill={C.forest} />
          <circle cx={110} cy={INTAKE_Y} r={24} fill={C.darker} />
          {doorOpen ? (
            <circle cx={110} cy={INTAKE_Y} r={18} fill="#0d0f0e" />
          ) : (
            <rect x={88} y={INTAKE_Y - 16} width={44} height={32} rx={4} fill="#8e9390" />
          )}
          {/* right column with screen and QR */}
          <rect x={218} y={44} width={174} height={362} fill={C.dark} stroke={C.darker} />
          <circle cx={234} cy={64} r={5} fill="#cfd2cf" />
          <Screen x={246} y={SCREEN_Y - 62} w={118} h={124} />
          <text x={305} y={330} textAnchor="middle" fontSize={10} fill="#e5e7e4" fontFamily="JetBrains Mono, monospace">
            QUÉT QR
          </text>
          <rect x={272} y={338} width={66} height={22} rx={2} fill="#1b1d1c" />
          <rect x={280} y={347} width={50} height={4} fill={p.phase === 'USER_IDENTIFIED' ? C.lime : C.fault} />
          {/* middle doors */}
          <rect x={8} y={414} width={204} height={62} fill={C.panel} stroke={C.steelDark} />
          <rect x={102} y={430} width={6} height={30} rx={2} fill={C.darker} />
          <rect x={218} y={414} width={174} height={62} fill={C.panel} stroke={C.steelDark} />
          <circle cx={330} cy={445} r={20} fill="#e2b417" />
          <circle cx={330} cy={445} r={13} fill={C.fault} className={p.fault === 'estop' ? 'blink' : ''} />
          <text x={262} y={449} textAnchor="middle" fontSize={9} fill={C.dark} fontFamily="JetBrains Mono, monospace">
            E-STOP
          </text>
          {/* storage door */}
          <rect x={8} y={482} width={384} height={378} fill={C.panel} stroke={C.steelDark} />
          <text x={200} y={560} textAnchor="middle" fontSize={13} fontWeight={600} fill={C.dark} fontFamily="Be Vietnam Pro, sans-serif">
            KHOANG THÙNG CHỨA
          </text>
          <text x={200} y={578} textAnchor="middle" fontSize={10} fill={C.dark} fontFamily="Be Vietnam Pro, sans-serif">
            Cửa có công tắc liên động
          </text>
          <rect x={370} y={640} width={7} height={44} rx={2} fill={C.darker} />
          <rect x={4} y={862} width={392} height={14} fill={C.forest} />
          {/* exterior fill hint */}
          <g transform="translate(150 700)">
            <rect x={0} y={0} width={100} height={10} rx={5} fill={C.steelDark} />
            <rect x={0} y={0} width={fill} height={10} rx={5} fill={fillColor} />
            <text x={50} y={26} textAnchor="middle" fontSize={10} fill={C.dark} fontFamily="JetBrains Mono, monospace">
              {Math.round(fill)} %
            </text>
          </g>
          {/* bottle entering intake */}
          <g style={{ transform: `translate(${p.phase === 'BOTTLE_INSERTED' ? 70 : p.phase === 'RETURNED' ? 40 : -60}px, ${INTAKE_Y - 13}px)`, opacity: ['BOTTLE_INSERTED', 'RETURNED'].includes(p.phase) ? 1 : 0 }} className="svg-move">
            <rect x={-60} y={0} width={70} height={26} rx={10} fill={rejectedTint ? '#f3d6d2' : C.pet} stroke="#7e98a3" />
            <rect x={-72} y={7} width={14} height={12} rx={2} fill={C.forest} />
          </g>
        </g>
      ) : (
        <g>
          <rect x={0} y={0} width={400} height={880} fill="#f1f2ef" stroke={C.darker} strokeWidth={6} />
          <rect x={6} y={880} width={388} height={20} fill={C.darker} />
          {/* control cabinet */}
          <rect x={222} y={56} width={156} height={206} fill="#e2e4e1" stroke={C.steelDark} />
          <rect x={236} y={72} width={44} height={60} fill="#fafafa" stroke="#aaa" />
          <rect x={294} y={72} width={66} height={70} fill="#2a2d2c" />
          <rect x={236} y={160} width={58} height={56} fill="#2f8a5a" />
          <rect x={306} y={170} width={30} height={42} fill="#2a2d2c" />
          <text x={300} y={248} textAnchor="middle" fontSize={9.5} fill={C.dark} fontFamily="JetBrains Mono, monospace">
            ESP32 · 4G · NGUỒN · RCD
          </text>
          {/* screen + QR */}
          <Screen x={240} y={278} w={120} h={58} />
          {/* chamber */}
          <rect x={58} y={268} width={150} height={104} fill="#e7ebec" stroke={C.dark} strokeWidth={2} />
          <rect x={120} y={268} width={20} height={14} fill={C.darker} />
          <rect x={92} y={270} width={18} height={4} fill="#fff7c2" />
          <rect x={150} y={270} width={18} height={4} fill="#fff7c2" />
          <rect x={196} y={308} width={10} height={22} fill={C.fault} opacity={0.85} />
          {scanning && <rect x={62} y={284} width={142} height={3} fill={C.lime} className="scanline" />}
          {/* outer sliding door */}
          <rect x={50} y={doorOpen ? 250 : 300} width={8} height={70} fill={C.dark} className="svg-move" style={{ transition: 'y 0.4s' }} />
          {/* intake opening */}
          <rect x={0} y={INTAKE_Y - 22} width={58} height={44} fill="#e7ebec" />
          <line x1={0} y1={INTAKE_Y - 22} x2={50} y2={INTAKE_Y - 22} stroke={C.dark} strokeWidth={2} />
          <line x1={0} y1={INTAKE_Y + 22} x2={50} y2={INTAKE_Y + 22} stroke={C.dark} strokeWidth={2} />
          {/* trapdoor leaves on load cell */}
          <g stroke={C.darker} strokeWidth={4} strokeLinecap="round">
            <line x1={74} y1={370} x2={trapOpen ? 84 : 128} y2={trapOpen ? 392 : 370} className="svg-move" />
            <line x1={192} y1={370} x2={trapOpen ? 182 : 138} y2={trapOpen ? 392 : 370} className="svg-move" />
          </g>
          <rect x={120} y={372} width={26} height={6} fill={C.amber} />
          {/* hopper and rollers */}
          <path d="M70 380 L106 392 M196 380 L160 392" stroke={C.dark} strokeWidth={2} fill="none" />
          <g>
            <polygon points={gear(108, 414, 24, 10)} fill={jam ? '#7a3a33' : '#6b706d'} stroke={C.darker} className={spinning ? 'roller-cw' : ''} />
            <circle cx={108} cy={414} r={5} fill={C.darker} />
            <polygon points={gear(158, 414, 24, 10)} fill={jam ? '#7a3a33' : '#6b706d'} stroke={C.darker} className={spinning ? 'roller-ccw' : ''} />
            <circle cx={158} cy={414} r={5} fill={C.darker} />
            {jam && <circle cx={133} cy={414} r={34} fill="none" stroke={C.fault} strokeWidth={3} className="blink" />}
          </g>
          <rect x={196} y={398} width={44} height={32} fill="#3d4240" />
          <text x={218} y={418} textAnchor="middle" fontSize={8} fill="#eee" fontFamily="JetBrains Mono, monospace">
            M
          </text>
          {/* drop-confirm light gate */}
          <line x1={90} y1={448} x2={176} y2={448} stroke={p.phase === 'DROP_CONFIRMED' ? C.lime : '#c9a9a6'} strokeWidth={p.phase === 'DROP_CONFIRMED' ? 3 : 1.5} strokeDasharray="4 3" />
          {/* shelf */}
          <rect x={14} y={458} width={372} height={8} fill="#c7cac6" />
          {/* ultrasonic sensors */}
          {[176, 296].map((x) => (
            <g key={x}>
              <path d={`M${x} 470 L${x - 30} ${BIN.y + BIN.h - fillH} L${x + 30} ${BIN.y + BIN.h - fillH} Z`} fill="#9ad0e6" opacity={0.28} />
              <rect x={x - 12} y={466} width={24} height={8} rx={2} fill="#2c6e8a" />
            </g>
          ))}
          {/* bin */}
          <rect x={BIN.x} y={BIN.y} width={BIN.w} height={BIN.h} fill="#dfe8ee" stroke={C.binDark} strokeWidth={3} />
          <rect
            x={BIN.x + 4}
            y={BIN.y + BIN.h - 4 - fillH}
            width={BIN.w - 8}
            height={fillH}
            fill={C.bin}
            opacity={0.85}
            style={{ transition: 'y 0.5s, height 0.5s' }}
          />
          {fillH > 6 &&
            Array.from({ length: Math.min(46, Math.floor(fillH / 7)) }).map((_, i) => {
              const fx = BIN.x + 12 + (((i * 97 + 31) % 17) / 17) * (BIN.w - 60);
              const fy = BIN.y + BIN.h - 12 - (((i * 53 + 11) % 23) / 23) * Math.max(4, fillH - 14);
              return (
                <rect key={i} x={fx} y={fy} width={30} height={5} rx={2} fill={C.pet} opacity={0.65} transform={`rotate(${((i * 37) % 40) - 20} ${fx + 15} ${fy + 2})`} />
              );
            })}
          {/* thresholds */}
          {[
            [p.warnPct, C.amber, '80 %'],
            [p.stopPct, C.fault, '95 %'],
          ].map(([v, c, l]) => {
            const y = BIN.y + BIN.h - 4 - (BIN.h - 8) * ((v as number) / 100);
            return (
              <g key={l as string}>
                <line x1={BIN.x - 6} y1={y} x2={BIN.x + BIN.w + 6} y2={y} stroke={c as string} strokeWidth={1.5} strokeDasharray="6 4" />
                <text x={BIN.x + BIN.w + 10} y={y + 4} fontSize={10} fill={c as string} fontFamily="JetBrains Mono, monospace">
                  {l as string}
                </text>
              </g>
            );
          })}
          <text x={BIN.x} y={BIN.y + BIN.h + 8} fontSize={9} fill={C.binDark} fontFamily="JetBrains Mono, monospace">
            THÙNG PET ≈ 0,24 m³
          </text>
          {/* drip tray */}
          <rect x={44} y={842} width={312} height={14} fill="#bfe0ee" stroke="#7fb3c9" />
          <text x={200} y={853} textAnchor="middle" fontSize={8.5} fill="#2c6e8a" fontFamily="JetBrains Mono, monospace">
            KHAY HỨNG NƯỚC
          </text>
          {/* e-stop + interlock */}
          <circle cx={392} cy={440} r={9} fill={C.fault} className={p.fault === 'estop' ? 'blink' : ''} />
          <rect x={386} y={600} width={8} height={18} fill="#e2b417" />
          {/* status light */}
          <rect x={62} y={252} width={90} height={6} rx={3} fill={col} className={p.phase === 'BLOCKED' || p.fault ? 'blink' : ''} />
          {/* bottle */}
          <g style={{ transform: `translate(${bottle.x}px, ${bottle.y}px) rotate(${bottle.r}deg) scale(1, ${bottle.sy})`, opacity: bottle.o }} className="svg-move">
            <rect x={-34} y={-13} width={64} height={26} rx={10} fill={rejectedTint ? '#f3d6d2' : C.pet} stroke="#7e98a3" />
            <rect x={-44} y={-6} width={12} height={12} rx={2} fill={C.forest} />
          </g>
          {p.phase === 'RETURNED' && (
            <path d="M58 300 L20 300" stroke={C.fault} strokeWidth={3} markerEnd="url(#arrowRed)" />
          )}
          {['FLATTENING', 'DROP_CONFIRMED'].includes(p.phase) && !p.fault && (
            <path d={`M133 440 L133 ${BIN.y + 40}`} stroke={C.forest} strokeWidth={3} className="flow-dash" />
          )}
          <defs>
            <marker id="arrowRed" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill={C.fault} />
            </marker>
          </defs>
          <text x={20} y={30} fontSize={10} fill={C.dark} fontFamily="JetBrains Mono, monospace">
            MẶT CẮT A–A (concept)
          </text>
        </g>
      )}

      {/* selected zone highlight */}
      {p.selectedZone &&
        (ZONE_AREAS[p.view][p.selectedZone] ?? []).map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx={6} fill="rgb(var(--c-lime) / 0.18)" stroke={C.forest} strokeWidth={2.5} pointerEvents="none" />
        ))}
      {/* numbered hotspot markers */}
      {p.onSelectZone &&
        ZONES.map((z, i) =>
          (MARKERS[p.view][z] ?? []).map(([cx, cy], k) => {
            const sel = p.selectedZone === z;
            return (
              <g
                key={`${z}-${k}`}
                role="button"
                tabIndex={k === 0 ? 0 : -1}
                aria-pressed={sel}
                aria-label={`${i + 1}. ${p.zoneNames?.[z] ?? z}`}
                onClick={() => p.onSelectZone?.(z)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    p.onSelectZone?.(z);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible>circle:last-of-type]:stroke-[4]"
              >
                {!sel && <circle cx={cx} cy={cy} r={16} fill={C.forest} opacity={0.35} className="pulse-ring" style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />}
                <circle cx={cx} cy={cy} r={24} fill="transparent" />
                <circle cx={cx} cy={cy} r={15} fill={sel ? C.forest : '#fff'} stroke={C.forest} strokeWidth={2.5} />
                <text x={cx} y={cy + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={sel ? '#fff' : C.forest} fontFamily="Be Vietnam Pro, sans-serif" pointerEvents="none">
                  {i + 1}
                </text>
              </g>
            );
          }),
        )}
    </svg>
  );
}
