# RE Hub operations update

Development continues from `re-prototype-v2`; the original `main` only has the Folium map.
Open `#hub` for the updated Vietnamese dashboard. The public site, deposit app and driver
experience remain available from the top navigation.

## Features

- **Network map:** OpenStreetMap, city picker, station ID/name search (accent-insensitive),
  fill percentages, status filters and station details. Offline readings are explicitly stale.
- **Collection quantities** (`#hub-analytics`): station/date/material/barcode-brand filters;
  daily bottle/kg chart, brand/material breakdowns and station-summary CSV. Only synced
  records count. Received, collected and recycled quantities remain separate.
- **Forecasts** (`#hub-forecasts`): up to 28 days of received history, smoothed hourly rates
  and weekday factors, opening hours, threshold times and 24/48/72-hour charts. Fewer than
  7 complete days or 30 accepted bottles uses the configured fallback rate. Optional
  exam/holiday (0.6×) and busy (1.4×) scenarios are explicit assumptions, persisted in settings
  and reused by dispatch. Calculations use Vietnam time. These are not learned seasonal
  effects or a validated AI model. Faulted stations have flat forecasts; offline readings
  remain stale. Missing telemetry and full bins can censor historical demand.
- **Dispatch:** trucks up to 1,000 kg; payload, bin volume, complete service within access
  windows, shift end and operator-entered driving bans. Every leg must fit outside the bans,
  including the final leg; waiting is included in total time. Default destination is the
  receiving container/partner. Choose minimum distance or duration. Invalid plans, including
  missing mandatory stops, cannot be assigned. Missing road cells are unreachable, never
  silently substituted with mock road distances. Full stops are selected first, followed by
  threshold/forecast stops, then optional nearby stops.
- **Driver handoff:** assigned routes appear in the existing driver experience.
  “Chia sẻ lộ trình” offers native sharing where supported, clipboard copy otherwise, plus a
  downloadable itinerary containing positions and arrival estimates. Sending is user-initiated.
  There is no SMS service or cross-device synchronization of bin-swap confirmations.
- **KPIs** (`#hub-kpis`): estimated VND/kg and kg/km joined to confirmed pickups on completed
  routes, mean fill at pickup, full-station hours clipped to the reporting period, and
  rejected/(accepted + rejected) rate. Costs are editable assumptions, distance is planned
  rather than measured mileage, and missing evidence displays “—”. Full hours use recorded
  threshold events through bin replacement; missing/truncated logs can undercount downtime.
- **EPR:** the existing flow retains brand attribution, pickup records, receiving weigh
  tickets, recycler documents and confirmed downstream mass. Exports are supporting evidence,
  not EPR certificates. Verified recycled mass is never invented from estimated brand shares.

## Solver boundary

The original `#hub-routes` screen is a single-vehicle browser planner.
Selection is greedy by urgency/capacity, then all visiting orders are searched for up to
7 selected stops. Above 7 stops it uses nearest-neighbour. It does not claim global optimality.
The optional driving bans conservatively apply to every leg; they are not a legal database
of geographic road restrictions. Community road providers still supply the road distances.

The new **Đội xe trực tiếp** screen (`#hub-fleet`) uses a Python OR-Tools multi-vehicle service
with weight/volume capacities, service windows, shifts, operator-entered bans and a shared
receiving endpoint. It persists dispatch and latest GPS in SQLite, broadcasts authenticated
WebSocket snapshots, and gives each driver a revocable, vehicle-scoped link. See
[server/README.md](server/README.md) for startup, security, deployment and solver details.

Station records and recognition remain illustrative. GPS is explicitly enabled by the driver
and comes from the device. Fleet pickup confirmations update shared progress; they do not
create weigh tickets, reset demo bins, or enter verified EPR/KPI mass in the original local flow.
Production station telemetry, recognition and shared evidence storage still need integrations.

## Verification

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

On Windows with Edge installed: set `PW_CHANNEL=msedge` for browser tests. Tests replace
community routing/tile services with deterministic local fixtures. `operations.test.ts`
covers historical forecasts, driving bans, service windows, assignment rejection and KPI joins.
`e2e/operations.spec.ts` covers map search, forecast persistence, filtered summaries and CSV,
route assignment/sharing, and 390-pixel layouts. Live map/routing availability is separate
from these mocked regression tests.
