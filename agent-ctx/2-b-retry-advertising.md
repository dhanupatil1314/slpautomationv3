# Task 2-b-retry — Advertising Modules (Playlists, Campaigns, Wizard, Inventory, Scheduling)

## Scope
Built 5 advertising module views + 5 API route files for the LakhirAd CMS, including 2 new detail-view routes wired into the client-side nav.

## Files Created / Modified

### API routes
- `src/app/api/playlists/route.ts` — added pagination + total count to GET list
- `src/app/api/playlists/[id]/route.ts` — extended with POST handler for add/remove items + PATCH modes for reorder and per-item attr updates; recomputes totalDuration on every change
- `src/app/api/campaigns/route.ts` — GET list (search + status + advertiser + city filters, pagination), POST create with optional device linking + initial approval-history entry
- `src/app/api/campaigns/[id]/route.ts` — GET detail (advertiser, playlist+items, devices, schedules, approval history, recent playback events, invoices, aggregate playback stats); PATCH meta; POST state-machine actions (submit/approve/reject/publish/pause/complete/cancel/reopen) with RBAC per action + add_device/remove_device
- `src/app/api/inventory/route.ts` — GET aggregate (computed availability state per device: available|reserved|maintenance|offline, per-city + per-zone + per-vehicle-type breakdowns)
- `src/app/api/scheduling/route.ts` — GET weekly schedule (defaults to current Mon–Sun, computes dayFlags per campaign showing which of the 7 days it overlaps)

### View components
- `src/components/module/playlists.tsx` — list view (KPIs, search/filter, desktop table + mobile cards, Create dialog) + `PlaylistDetailView` builder (ordered media list with thumbnails, Up/Down reorder buttons, Add Media dialog picking from approved media, Remove item, Edit metadata dialog, Delete playlist, linked campaigns)
- `src/components/module/campaigns.tsx` — list view (KPIs, search/status/advertiser filters, desktop table + mobile cards) + `CampaignDetailView` with 5 tabs (Overview / Devices / Schedule / Approval History timeline / Playback Stats with completion distribution + recent events). Context-dependent action buttons: Submit / Approve+Reject / Publish / Pause+Complete / Cancel — each gated by RBAC and POSTing to the [id] action endpoint. Reject requires reason dialog. Add/remove devices via dialogs.
- `src/components/module/campaign-wizard.tsx` — 13-step wizard with stepper UI (Name → Advertiser → Media → Cities → Devices → Date Range → Time Range → Days → Frequency → Budget → Price → Review → Submit). Per-step validation. Price breakdown = devices × days × frequencyPerHour × 14hrs × ₹2/play. On submit, POSTs campaign with status='submitted' and navigates to the new campaign detail.
- `src/components/module/inventory.tsx` — 5 KPI cards (Total / Available / Reserved / Maintenance / Offline with %), filters (city/zone/availability), 4-tabbed view: By City table, By Zone cards, By Vehicle Type grid, Device-level list (desktop table + mobile cards). Inline city change resets zone filter (avoids setState-in-effect lint rule).
- `src/components/module/scheduling.tsx` — Weekly calendar grid with Mon–Sun columns, one row per campaign, colored gradient blocks per advertiser (deterministic hash → palette, NO indigo/blue per brand rules). Week navigation (Prev / This Week / Next). Filters: advertiser, city. Click any block → openDetail('campaign-detail', id). Campaign legend below the grid.

### Wiring
- `src/lib/store.ts` — added `'playlist-detail'` and `'campaign-detail'` to `ViewKey` union
- `src/components/app-shell.tsx` — imported `PlaylistDetailView` and `CampaignDetailView`, added switch cases

## Patterns Followed
- `useFetch` + `mutate` for all data operations
- Shared components: `PageHeader`, `KpiCard`, `StatusBadge`, `EmptyState`, `ErrorState`, `TableSkeleton`, `Pagination`
- `formatINR`, `formatNumber`, `formatDate`, `formatDateTime`, `timeAgo`, `secondsToDuration` from `@/lib/format`
- `hasPermission(role, 'xxx.view|create|edit|delete|approve|publish')` RBAC checks in both UI and API
- `auditLog()` on every mutating API call
- `getCurrentUser()` auth on every API route
- shadcn/ui components only (button, card, input, textarea, label, badge, checkbox, select, dialog, tabs, progress)
- Lucide icons throughout
- Brand orange (#f97316 / `primary`) used for emphasis; no indigo/blue
- Responsive: desktop table (`hidden md:block`) + mobile cards (`md:hidden`) on all list views
- Toasts via `sonner`
- Media thumbnails are gradient placeholder divs (primary for video, success/green for image) with media name overlaid

## Lint Result
`bun run lint` → **0 errors, 0 warnings** (clean)
