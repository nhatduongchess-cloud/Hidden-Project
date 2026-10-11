# RE · Smart PET Recovery System — interactive prototype (PCIC 2026)

A clickable prototype of **RE**, a proposed smart PET bottle recovery station, and **RE Hub**, the
operations and traceability tool behind it. The interface is in Vietnamese.

RE is a proposal. It has 3D station designs and this prototype; it has no validated physical prototype,
operating network, signed partners or test data. Everything hardware-, recognition- and
evidence-related is **simulated**, every figure is fictional seed data, and the site labels it so.
The road map and road routing are real public OpenStreetMap services called from the browser; the
station locations on that map are illustrative (see "Road map and navigation").

Content follows the "Proposal tiếng việt" tab of the PCIC 2026 document: an 800 × 800 × 1,800 mm
station, a 0.24 m³ bin, two ultrasonic fill sensors, 80 % / 95 % thresholds, PET only, and a pilot of
3 stations at 1 university for 3 months.

## Four experiences

A dark bar at the top switches between them. **Đặt lại demo** restores the seed data.

| Experience | Start at | Built for | Screens |
|---|---|---|---|
| Website | `#home` | Public, desktop first | A Landing, H Station explorer (`#explorer`), pilot (`#pilot`) |
| Ứng dụng trả chai | `#app` | Students, 390 px first | B Home, C Return flow (`#app-return`), stations, history, rewards |
| RE Hub | `#hub` | Operators and brands, 1440 px first | D Overview, E Station detail, F Routes, G Traceability, transactions, settings |
| Tài xế | `#driver` | Collection driver, phone | F Route, current stop, bin-swap confirmation; nearest stations on a road map (`#driver-map`); turn-by-turn navigation (`#driver-nav-RE-003`) |
| Hệ thống thiết kế | `#design` | Designers and developers | Tokens, contrast, type, components, states, responsive rules |

All four read and write one record set kept in the browser. RE Hub only counts records a station has
synced, so an offline station's deposits appear there only after reconnection.

## Run it

Node 18 or later (tested on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 73 domain unit tests (Vitest)
npm run build        # type-check + static site in dist/
npm run preview      # serve dist/ on http://localhost:4173
npm run test:e2e     # 20 Playwright browser tests against the production build (map services stubbed)
npm run build:single # one self-contained HTML file in dist-single/index.html
```

No API keys, accounts or backend are needed. The road map needs internet access to the public map
services listed below; without it the app falls back to a labelled straight-line estimate.

## Deploy on Vercel

The repository root is the app. `vercel.json` sets the framework (Vite), the build command
(`npm run build`) and the output directory (`dist`). In Vercel choose **Add New → Project**, import
this repository, keep the detected settings and deploy. Routing uses `#` addresses, so no rewrites
are needed.

## Source layout

```
src/
  domain/      pure TypeScript: types, seed, recognition, deposit steps, reducer, selectors,
               ops (attention ranking, staleness, traceability gaps), dispatch and routing,
               report and CSV builders, unit tests
  domain/geo.ts, nav.ts, places.ts
               distances and polylines, turn-by-turn progress and Vietnamese instructions,
               the "nearest station by driving time" ranking
  integrations/ interfaces for future telemetry, map, auth and evidence storage, with local
               simulated implementations; roadRouting.ts is the live Valhalla → OSRM → estimate
               client; supabase.ts is a documented stub only
  components/RoadMap.tsx
               Leaflet road map, loaded only on pages that show a map
  components/  UI kit (buttons, badges, meters, dialogs, drawers, toasts), icons, station drawing
  pages/site   landing, station explorer, pilot
  pages/app    mobile app, return flow, live station view, demo control panel
  pages/driver driver route view
  pages/hub    RE Hub layout, overview, stations, routes, transactions, traceability, settings
  pages/design design system reference
e2e/           Playwright critical paths
```

## Rules enforced in the domain layer

- Points are credited once, only after the drop sensor confirms the bottle is in the bin. Rejected,
  jammed and aborted items record zero mass and zero points.
- Capacity is checked before each bottle; at 95 % the station refuses the next one.
- A reading older than 15 minutes, or from an offline station, is stale: RE Hub shows the last value
  with its time and will not let a connectivity task be closed while the station is still offline.
- "Cần xử lý" ranks stopped and faulted stations first (faults before full bins), then stale, then
  warnings and forecasts.
- A collection task closes only when the driver confirms the swap with the new bin ID; a skipped stop
  keeps its task open.
- A batch keeps estimated, weighed and confirmed downstream mass apart. Downstream mass can be entered
  only after handover and a recycler document. Weighed mass is never split by brand. The export is
  "Tài liệu hỗ trợ báo cáo EPR", not a certificate.

## What is simulated

| Area | In this prototype | Future integration point |
|---|---|---|
| Station events | Demo control panel | `TelemetrySource` (4G upload, idempotent by record id) |
| Bottle recognition | Rule-based fusion of chosen camera class, confidence, barcode, weight | On-station model and barcode catalogue |
| Fill level | Accepted mass ÷ bin volume × compacted-PET density | Two ultrasonic sensors |
| Map | OpenStreetMap tiles (openstreetmap.org, then OpenStreetMap France); illustrative station coordinates, editable in RE Hub → Cài đặt. RE Hub's overview keeps a campus schematic | Real station locations after a site survey |
| Routing | Real road routing from public Valhalla (truck) / OSRM (car) demo servers; straight-line estimate if both fail. No traffic or time-of-day truck bans | A self-hosted Valhalla/OSRM server; a CVRPTW solver for larger fleets |
| Truck position | Simulated driving along the route, or the phone's GPS when the driver allows it | Vehicle telematics |
| Data | Browser localStorage | `DataRepository` |
| Roles | Operator / brand switch, not authentication | `AuthProvider` |
| Evidence files | File name and size only, nothing uploaded | `EvidenceStorage` |

Brands are "Nhãn hàng minh họa A/B/C". There are no testimonials, partners, sponsors, awards or
operating statistics anywhere in the site.

## Road map and navigation

The driver view guides the collection truck to the nearest, fastest station within the collection
zone, with a phone-navigation interface, and RE Hub plans the best visiting order on road travel times.

- **Nearest station** (`#driver-map`). Stations that need a pickup (≥ 95 %, ≥ 80 %, forecast to reach
  80 % before the next run, or on the assigned route) inside the collection zone are ranked by **driving
  time** from the truck, using a one-to-many travel-time matrix from the routing service. When the
  closest station as the crow flies is not the fastest by road, the screen says so.
- **Turn-by-turn** (`#driver-nav-<station>`). Route line with casing, maneuver banner with arrow and
  distance, "Sau đó" chip for a close follow-up turn, ETA, remaining time and distance, steps list,
  recenter. The truck is simulated along the route (×1, ×5, ×20, skip to the next turn) or follows the
  phone's GPS; leaving the route by more than 45 m on two fixes requests a new route. Arriving within
  30 m opens the bin-swap confirmation.
- **Best route** (RE Hub → Tuyến thu gom). The planner's distance matrix is now the road travel-time
  matrix between the depot, every station and the receiving partner. It tries every visiting order up
  to 7 stops and keeps the fastest feasible one (capacity, access windows, shift end); the comparison
  with the fixed order reports driving time. The planned route and the comparison are drawn on the map.
- **Routing sources, in order**: Valhalla on `valhalla1.openstreetmap.de` with the truck costing
  (2.5 m high, 2.8 t, so one-way streets, turn restrictions and tagged truck limits apply), then OSRM on
  `router.project-osrm.org` (car profile), then a straight line × 1.35 at 20 km/h. Every time, line
  and list says which one produced it. Both servers are free community demos with fair-use limits; a
  pilot would self-host one on the same OpenStreetMap data.
- **Base map**: OpenStreetMap's own tiles (`tile.openstreetmap.org`), then OpenStreetMap France if they
  fail or stay silent for 5 s, then a notice that the base map could not load. CARTO's basemaps are not used: they now return an
  "API key required" image to requests without a key. Both OSM servers have fair-use tile policies, so a
  public launch would need its own tile service.
- **What leaves the browser**: map tile requests, and the coordinates of stations, depot, partner and
  truck sent to the routing servers. No transactions, users or station readings.
- **Not modelled**: live traffic, time-of-day truck bans in Ho Chi Minh City, parking at the station.
- **Locations**: the three stations, depot, partner and zone are illustrative points in Thủ Đức, not a
  chosen pilot site. Drag them or type coordinates in RE Hub → Cài đặt → Vị trí trên bản đồ.

Browser tests replace the tile and routing servers with local stand-ins (`e2e/roadMocks.ts`), including
tests where Valhalla or both services fail. `SCREENS=<folder> npx playwright test screens` captures
screenshots of the map screens at 390, 834 and 1440 px.

To check the real services, run `npm run build`, then `LIVE=<folder> npm run test:live` on a network that can
reach them (in PowerShell: `$env:LIVE="live-run"; $env:PW_CHANNEL="msedge"; npm run test:live`). It drives the
driver map, navigation to the fastest station, arrival and the RE Hub plan with no mocks, and saves
screenshots, a video and `summary.json` (which routing service answered, the ranking and the steps).
The video needs Playwright's ffmpeg (`npx playwright install ffmpeg`); set `LIVE_VIDEO=0` to skip it. Set `BASE_URL` to the published address to run the same check against a deployed copy.

See `WALKTHROUGH.md` for a three-minute demo script.
