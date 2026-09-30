# Task 2-a — Network Entities (Vehicles, Drivers, Owners, Screens, Locations)

## Agent
full-stack-developer (network entities)

## Scope
Built 5 module views + 9 API route files for the LakhirAd CMS network-entity group.

## Files Created

### API Routes (9 files)
- `src/app/api/vehicles/route.ts` — GET list (pagination+search+type/status filter+sort), POST create
- `src/app/api/vehicles/[id]/route.ts` — GET detail (with device/driver/owner/screen/recent playback/earnings), PATCH update
- `src/app/api/drivers/route.ts` — GET list (with current-month/total/pending earnings rollup), POST create
- `src/app/api/drivers/[id]/route.ts` — GET detail (with vehicles/earnings history/payouts), PATCH update
- `src/app/api/owners/route.ts` — GET list (with vehicle count/total earnings/pending+paid payout aggregates), POST create
- `src/app/api/owners/[id]/route.ts` — GET detail (with vehicles list/earnings/payouts), PATCH update
- `src/app/api/screens/route.ts` — GET list (with vehicle lookup), POST create
- `src/app/api/screens/[id]/route.ts` — GET detail (with mounted vehicle + driver/owner), PATCH update
- `src/app/api/locations/route.ts` — GET cities (with zone/device/vehicle counts) OR single city with zones + device counts; POST create city or zone (discriminated by `type` field)

### Module Views (5 files)
- `src/components/module/vehicles.tsx` — VehiclesView: search/type/status/sort filters, desktop table + mobile cards, Add Vehicle dialog (registration/type/manufacturer/model/city/zone/owner/driver/agreement/status), Detail dialog with KPI strip (plays 30d, driver+owner earnings, install date), driver/owner card, device+screen card, recent playback scroll list, 6-month earnings split (driver + owner)
- `src/components/module/drivers.tsx` — DriversView: search/KYC/status/sort filters, desktop table + mobile cards with avatar + driver-score progress bar (red<50, yellow<75, green>=75), Add Driver dialog (name/mobile/email/city/UPI/KYC/agreement/status/score slider), Detail dialog with KPI strip, score card, assigned vehicles list, 12-month earnings table (base/share/bonus/total/status), payouts list
- `src/components/module/owners.tsx` — OwnersView: search/status/sort filters, desktop table + mobile cards with vehicle count / revenue share % / total earnings / pending payout, Add Owner dialog (name/mobile/email/city/address/bank/IFSC/UPI/revenue share slider/status), Detail dialog with KPI strip, vehicles list, 12-month earnings table, payouts list
- `src/components/module/screens.tsx` — ScreensView: search/orientation/status/sort filters, desktop table + mobile cards with size/resolution/orientation/brightness bar/vehicle, Add Screen dialog (screen ID/model/size/resolution/manufacturer/serial/orientation/brightness slider/warranty/vehicle mount), Detail dialog with specs card + mounted vehicle card
- `src/components/module/locations.tsx` — LocationsView: city grid (state/zone count/device count/vehicle count per card), click city → drill into zones view (city summary banner + zone cards with device count + radius), Add City dialog (name/state/lat/lng), Add Zone dialog (city select / name / radius)

## Design Decisions
- All dialogs use shadcn `Dialog` (max-w-2xl or max-w-3xl, scrollable) — consistent with devices module Add dialog
- Driver score uses `Progress` with custom indicator classes (`[&_[data-slot=progress-indicator]]:bg-destructive|warning|success`) for color bands
- Avatars use `Avatar` + `AvatarFallback` with color-coded backgrounds based on driver score (drivers) or brand orange (owners)
- Each API route enforces: `getCurrentUser()` auth → `hasPermission(role, 'xxx.view')` for GETs and `xxx.create`/`xxx.edit` for writes → `auditLog()` for all mutations
- Locations API supports optional `?cityId=X` query to return single city + zones with per-zone device counts (via `groupBy` on devices.zone)
- Vehicle detail aggregates driver + owner earnings separately (driver can have multiple vehicles, but we scope to current vehicle's driver/owner)
- Owners list query batches aggregate earnings via a single `findMany` on OwnerEarning + `findMany` on Payout for all visible owner IDs (avoids N+1)

## RBAC Used
- `vehicles.view` / `vehicles.create` / `vehicles.edit`
- `drivers.view` / `drivers.create` / `drivers.edit`
- `owners.view` / `owners.create` / `owners.edit`
- `screens.view` / `screens.create` / `screens.edit`
- `locations.view` / `locations.create`

## Audit Actions Logged
- `vehicle_create`, `vehicle_update`
- `driver_create`, `driver_update`
- `owner_create`, `owner_update`
- `screen_create`, `screen_update`
- `city_create`, `zone_create`

## Lint Status
- `bun run lint` reports 0 errors across all my files (vehicles.tsx, drivers.tsx, owners.tsx, screens.tsx, locations.tsx, and all 9 API route files).
- Remaining lint errors (20) are in modules owned by other agents (driver-earnings, engineers, proof-of-play, revenue, users) and analytics API route — not in my scope.

## Patterns Followed
- Same visual structure as `devices.tsx`: PageHeader → filter row → ErrorState/TableSkeleton/EmptyState/list → Pagination
- Mobile-first: desktop `hidden md:block` table + `md:hidden` card grid
- `useFetch(url, {refreshKey})` for GETs, `mutate(url, method, body)` for writes, `toast` from sonner for feedback
- `formatINR`, `formatNumber`, `formatDate`, `timeAgo`, `StatusBadge` from shared/format
- Brand color is orange (primary), no indigo/blue introduced

## Handoff Notes for Other Agents
- Vehicle/Driver/Owner detail dialogs surface earnings + payouts data that the future `driver-earnings`, `payouts`, and `revenue` modules can deep-link into.
- Locations API returns device counts per zone via `db.device.groupBy({ by: ['zone'] })` — `device.zone` is a free-text string, so zone name must match exactly for counts to be accurate.
- Screens can be mounted on a vehicle via `vehicleId` (1:1) — creating a screen without a vehicle leaves it in inventory for later mounting.
