/**
 * Pilot scenario calculator. All inputs are assumptions; outputs are projections, not results.
 * Time basis: annual figures use `operatingDaysPerYear`; period figures scale annual figures by `periodMonths / 12`.
 * Scope: station network economics (stations, collection, rewards, optional network fixed cost).
 * Excludes the processing facility, taxes, financing and depreciation.
 */
export interface CalcInput {
  stations: number;
  bottlesPerStationDay: number;
  bottleMassG: number;
  operatingDaysPerYear: number;
  periodMonths: number;
  materialPriceVndKg: number;
  includeService: boolean;
  serviceFeeVndKg: number;
  includeSponsorship: boolean;
  sponsorshipVndStationMonth: number;
  investmentVndStation: number;
  /** Site, power, connectivity, maintenance. Excludes collection and rewards, which have their own lines. */
  operatingVndStationYear: number;
  collectionVndKg: number;
  rewardVndBottle: number;
  networkFixedVndYear: number;
}

export interface CalcOutput {
  bottlesYear: number;
  massKgYear: number;
  revenue: { material: number; service: number; sponsorship: number; total: number };
  cost: { operating: number; collection: number; rewards: number; networkFixed: number; total: number };
  netYear: number;
  period: { months: number; bottles: number; massKg: number; revenue: number; cost: number; net: number };
  investment: number;
  /** Simple payback in years; null = no payback under these assumptions (non-positive annual cash flow). */
  paybackYears: number | null;
}

export function calculate(i: CalcInput): CalcOutput {
  const n = Math.max(0, i.stations);
  const bottlesYear = n * i.bottlesPerStationDay * i.operatingDaysPerYear;
  const massKgYear = (bottlesYear * i.bottleMassG) / 1000;
  const material = massKgYear * i.materialPriceVndKg;
  const service = i.includeService ? massKgYear * i.serviceFeeVndKg : 0;
  const sponsorship = i.includeSponsorship ? n * i.sponsorshipVndStationMonth * 12 : 0;
  const revenueTotal = material + service + sponsorship;
  const operating = n * i.operatingVndStationYear;
  const collection = massKgYear * i.collectionVndKg;
  const rewards = bottlesYear * i.rewardVndBottle;
  const networkFixed = i.networkFixedVndYear;
  const costTotal = operating + collection + rewards + networkFixed;
  const netYear = revenueTotal - costTotal;
  const f = i.periodMonths / 12;
  const investment = n * i.investmentVndStation;
  return {
    bottlesYear,
    massKgYear,
    revenue: { material, service, sponsorship, total: revenueTotal },
    cost: { operating, collection, rewards, networkFixed, total: costTotal },
    netYear,
    period: {
      months: i.periodMonths,
      bottles: bottlesYear * f,
      massKg: massKgYear * f,
      revenue: revenueTotal * f,
      cost: costTotal * f,
      net: netYear * f,
    },
    investment,
    paybackYears: netYear > 0 && investment > 0 ? investment / netYear : netYear > 0 ? 0 : null,
  };
}

export const BASE_STATION: CalcInput = {
  stations: 1,
  bottlesPerStationDay: 300,
  bottleMassG: 22,
  operatingDaysPerYear: 365,
  periodMonths: 12,
  materialPriceVndKg: 7000,
  includeService: true,
  serviceFeeVndKg: 1500,
  includeSponsorship: true,
  sponsorshipVndStationMonth: 1_500_000,
  investmentVndStation: 45_000_000,
  operatingVndStationYear: 8_000_000,
  collectionVndKg: 1500,
  rewardVndBottle: 25,
  networkFixedVndYear: 0,
};

export const PRESETS: { id: string; input: CalcInput }[] = [
  { id: 'pilot', input: { ...BASE_STATION, stations: 3, periodMonths: 3, includeService: false, includeSponsorship: false } },
  { id: 'one', input: { ...BASE_STATION } },
  { id: 'net30', input: { ...BASE_STATION, stations: 30, networkFixedVndYear: 700_000_000 } },
  { id: 'net100', input: { ...BASE_STATION, stations: 100, networkFixedVndYear: 700_000_000 } },
];
