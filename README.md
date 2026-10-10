# RE · Smart PET Recovery System — interactive prototype (PCIC 2026)

A clickable prototype of **RE**, a proposed smart PET bottle recovery station, and **RE Hub**, the
operations and traceability tool behind it. The interface is in Vietnamese.

RE is a proposal. It has 3D station designs and this prototype; it has no validated physical prototype,
operating network, signed partners or test data. Everything hardware-, recognition-, routing- and
evidence-related is **simulated**, every figure is fictional seed data, and the site labels it so.

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
| Tài xế | `#driver` | Collection driver, phone | F Route, current stop, bin-swap confirmation |
| Hệ thống thiết kế | `#design` | Designers and developers | Tokens, contrast, type, components, states, responsive rules |

All four read and write one record set kept in the browser. RE Hub only counts records a station has
synced, so an offline station's deposits appear there only after reconnection.

## Run it

Node 18 or later (tested on Node 22).

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # 48 domain unit tests (Vitest)
npm run build        # type-check + static site in dist/
npm run preview      # serve dist/ on http://localhost:4173
npm run test:e2e     # 12 Playwright browser tests against the production build
npm run build:single # one self-contained HTML file in dist-single/index.html
```

No API keys, accounts or backend are needed.

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
  integrations/ interfaces for future telemetry, routing, map, auth and evidence storage,
               with local simulated implementations; supabase.ts is a documented stub only
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
| Map | Illustrative campus schematic, no real coordinates | `MapProvider` |
| Routing | Mock distance matrix, small exhaustive search, labelled illustrative | `RoutingProvider` on road distances |
| Data | Browser localStorage | `DataRepository` |
| Roles | Operator / brand switch, not authentication | `AuthProvider` |
| Evidence files | File name and size only, nothing uploaded | `EvidenceStorage` |

Brands are "Nhãn hàng minh họa A/B/C". There are no testimonials, partners, sponsors, awards or
operating statistics anywhere in the site.

See `WALKTHROUGH.md` for a three-minute demo script.
