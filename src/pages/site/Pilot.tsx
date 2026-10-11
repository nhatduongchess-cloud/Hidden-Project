import { useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { calculate, PRESETS, BASE_STATION, type CalcInput } from '../../domain/calculator';
import { NumberField, Switch, Badge } from '../../components/ui';
import { Icon } from '../../components/icons';
import { n0, n1, trd } from '../../lib/format';
import { Breadcrumbs, SITE_WRAP } from './SiteLayout';

type NumKey = { [K in keyof CalcInput]: CalcInput[K] extends number ? K : never }[keyof CalcInput];

export function PilotPage() {
  const t = useT();
  const p = t.hub.pilot;
  const [inp, setInp] = useState<CalcInput>(PRESETS[0].input);
  const [preset, setPreset] = useState('pilot');
  const out = useMemo(() => calculate(inp), [inp]);
  const set = (k: keyof CalcInput, v: number | boolean) => {
    setInp((i) => ({ ...i, [k]: v }));
    setPreset('');
  };
  const num = (k: NumKey, step = 1, unit?: string) => (
    <NumberField key={k} id={`calc-${k}`} label={p.fields[k]} value={inp[k]} min={0} step={step} onChange={(v) => set(k, v)} hint={p.hints[k]} unit={unit} />
  );
  const row = (label: string, year: number, strong = false, neg = false) => (
    <tr className={strong ? 'font-semibold' : ''}>
      <td>{label}</td>
      <td className={`text-right tnum ${neg ? 'text-muted' : ''}`}>{neg && year ? '−' : ''}{trd(year)}</td>
      <td className={`text-right tnum ${neg ? 'text-muted' : ''}`}>{neg && year ? '−' : ''}{trd((year * inp.periodMonths) / 12)}</td>
    </tr>
  );

  return (
    <div className={`${SITE_WRAP} flex flex-col gap-5 pt-4`}>
      <Breadcrumbs items={[['Trang chủ', '#home'], ['Thí điểm và lộ trình', null]]} />
      <div className="shop-card p-5">
        <h1 className="text-2xl font-medium text-shop-text md:text-[28px]">Kinh tế thí điểm: thử các giả định</h1>
        <p className="mt-2 max-w-[80ch] text-sm text-shop-text">{p.intro}</p>
      </div>
      <div className="grid gap-px overflow-hidden rounded-sm border border-shop-line bg-shop-line md:grid-cols-3">
        {[
          { k: 'Bán vật liệu', who: 'Nhà tái chế', v: 'Chai PET một dòng, đã cán dẹt; về sau là mảnh PET sạch từ trạm xử lý.' },
          { k: 'Dịch vụ truy xuất', who: 'Nhãn hàng có nghĩa vụ EPR', v: 'Bản ghi thu gom và hồ sơ lô để hỗ trợ báo cáo. Mức phí là giả định, chưa có hợp đồng.' },
          { k: 'Tài trợ trạm', who: 'Nhãn hàng, chủ địa điểm', v: 'Tài trợ đặt trạm và nội dung trên màn hình. Chưa có nhà tài trợ.' },
        ].map((r) => (
          <div key={r.k} className="bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-ink">{r.k}</h2>
              <Badge tone="slate">Đề xuất</Badge>
            </div>
            <div className="mt-0.5 text-xs text-muted">Bên trả tiền: {r.who}</div>
            <p className="mt-2 text-sm text-ink-2">{r.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={p.presets}>
        {PRESETS.map((x) => (
          <button
            key={x.id}
            aria-pressed={preset === x.id}
            className={`btn btn-sm rounded-full ${preset === x.id ? 'bg-shop-nav-2 text-white' : 'btn-shop-plain'}`}
            onClick={() => {
              setInp(x.input);
              setPreset(x.id);
            }}
          >
            {p.presetNames[x.id]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <fieldset className="shop-card grid gap-3 p-4 sm:grid-cols-2">
            <legend className="float-left w-full text-sm font-bold text-shop-text sm:col-span-2">{p.volume}</legend>
            {num('stations')}
            {num('bottlesPerStationDay')}
            {num('bottleMassG', 0.5)}
            {num('operatingDaysPerYear')}
          </fieldset>
          <fieldset className="shop-card grid gap-3 p-4 sm:grid-cols-2">
            <legend className="float-left w-full text-sm font-bold text-shop-text sm:col-span-2">{p.revenue}</legend>
            {num('materialPriceVndKg', 100)}
            <div className="flex flex-col gap-2 sm:col-span-2 sm:grid sm:grid-cols-2 sm:gap-3">
              <div className="flex flex-col gap-2">
                <Switch id="calc-inc-service" label={p.fields.includeService} checked={inp.includeService} onChange={(v) => set('includeService', v)} />
                {inp.includeService && num('serviceFeeVndKg', 100)}
              </div>
              <div className="flex flex-col gap-2">
                <Switch id="calc-inc-spons" label={p.fields.includeSponsorship} checked={inp.includeSponsorship} onChange={(v) => set('includeSponsorship', v)} />
                {inp.includeSponsorship && num('sponsorshipVndStationMonth', 100000)}
              </div>
            </div>
          </fieldset>
          <fieldset className="shop-card grid gap-3 p-4 sm:grid-cols-2">
            <legend className="float-left w-full text-sm font-bold text-shop-text sm:col-span-2">{p.costs}</legend>
            {num('investmentVndStation', 1000000)}
            {num('operatingVndStationYear', 100000)}
            {num('collectionVndKg', 100)}
            {num('rewardVndBottle', 5)}
            {num('networkFixedVndYear', 10000000)}
          </fieldset>
          <fieldset className="shop-card grid gap-3 p-4 sm:grid-cols-2">
            <legend className="float-left w-full text-sm font-bold text-shop-text sm:col-span-2">{p.basis}</legend>
            {num('periodMonths')}
            <button type="button" className="btn btn-ghost self-end justify-self-start" onClick={() => (setInp(BASE_STATION), setPreset('one'))}>
              Khôi phục giả định cơ sở
            </button>
          </fieldset>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="shop-card sticky top-[60px] border border-shop-line p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">Kết quả</h2>
              <Badge tone="slate" icon="sparkle">{t.common.projection}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-muted">{p.out.mass} / năm</div>
                <div className="text-2xl font-semibold tnum">{n0(out.massKgYear)} kg</div>
                <div className="text-xs text-muted tnum">{n0(out.bottlesYear)} chai</div>
              </div>
              <div>
                <div className="text-xs text-muted">{p.out.payback}</div>
                {out.paybackYears === null ? (
                  <div className="flex items-start gap-1.5 text-base font-semibold text-fault-ink"><Icon name="stop" size={18} className="mt-0.5" />{p.out.noPayback}</div>
                ) : (
                  <div className="text-2xl font-semibold tnum">{p.out.years(n1(out.paybackYears))}</div>
                )}
                <div className="text-xs text-muted">
                  {p.out.investment}: {trd(out.investment)}
                </div>
              </div>
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className="table-base min-w-[360px]">
                <thead>
                  <tr>
                    <th />
                    <th className="text-right">{p.perYear}</th>
                    <th className="text-right">{p.perPeriod(inp.periodMonths)}</th>
                  </tr>
                </thead>
                <tbody>
                  {row(p.out.material, out.revenue.material)}
                  {row(p.out.service, out.revenue.service)}
                  {row(p.out.sponsorship, out.revenue.sponsorship)}
                  {row(p.out.revenueTotal, out.revenue.total, true)}
                  {row(p.out.operating, out.cost.operating, false, true)}
                  {row(p.out.collection, out.cost.collection, false, true)}
                  {row(p.out.rewards, out.cost.rewards, false, true)}
                  {row(p.out.networkFixed, out.cost.networkFixed, false, true)}
                  {row(p.out.costTotal, out.cost.total, true, true)}
                  <tr className={`font-semibold ${out.netYear < 0 ? 'text-fault-ink' : 'text-forest-ink'}`}>
                    <td>{p.out.net} ({out.netYear >= 0 ? 'thặng dư' : 'thâm hụt'})</td>
                    <td className="text-right tnum">{trd(out.netYear)}</td>
                    <td className="text-right tnum">{trd(out.period.net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">{p.scope}</p>
          </div>

          <div className="shop-card p-5">
            <h2 className="text-sm font-semibold">{p.integrationsTitle}</h2>
            <p className="mt-1 text-xs text-muted">{p.integrationsNote}</p>
            <ul className="mt-3 divide-y divide-line/70 text-[13px]">
              {p.integrations.map(([k, v]) => (
                <li key={k} className="flex flex-wrap justify-between gap-2 py-1.5">
                  <span className="font-medium">{k}</span>
                  <span className="text-muted">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
