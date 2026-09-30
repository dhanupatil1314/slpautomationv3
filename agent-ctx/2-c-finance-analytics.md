# Task 2-c — Finance & Analytics Modules (Proof of Play, Analytics, Billing, Revenue, Driver Earnings, Payouts)

## Agent
full-stack-developer (finance/analytics)

## Scope
Built 6 module views + 9 API route files for the LakhirAd CMS finance/analytics module group.

## Files Created

### API Routes (9 files)
- `src/app/api/proof-of-play/route.ts` — GET verified playback events (filters: campaignId, deviceId, status, range today/7d/30d/custom); includes summary (totalVerifiedPlays, completion rate, failed, active devices) and filter option lists
- `src/app/api/analytics/route.ts` — GET aggregated analytics (campaign/device/network tabs); computes campaign scheduled-vs-verified-vs-failed, device uptime/downtime/health averages, network city-wise performance + daily trend; range param: today/7d/30d
- `src/app/api/billing/route.ts` — GET invoices list (filters: status, search by invoice#/campaign/advertiser), POST create invoice (auto-computes 18% GST, generates sequential invoice number); returns KPI summary (totalBilled, totalPaid, outstanding, overdue)
- `src/app/api/invoices/[id]/route.ts` — GET invoice detail (with campaign/advertiser/org/payments), PATCH for `mark_paid` / `refund` / `partially_refund` actions; creates Payment records with provider/method fields (razorpay/manual integration-ready)
- `src/app/api/revenue/route.ts` — GET revenue transactions (filters: range/city/campaign); returns KPI totals (gross, platform, owner, driver, IoT, cloud, maintenance, payment fees, net), 6-month trend, top-10 city breakdown, filter lists
- `src/app/api/earning-rules/route.ts` — GET active earning rule (configurable earning engine — NEVER hardcode), PATCH update (requires settings.edit; validates platform+owner+driver shares = 100%)
- `src/app/api/driver-earnings/route.ts` — GET list (filters: driverId, month, status) with totals aggregates + active rule + drivers/months filter lists; POST recalculate (recomputes earnings for driver+month using the active rule — base + revenueShare + uptimeBonus + campaignBonus + complianceBonus − servicePenalty)
- `src/app/api/driver-earnings/[id]/route.ts` — GET earning detail with rule context, PATCH approve (pending→approved)
- `src/app/api/payouts/route.ts` — GET list (filters: status, recipientType, month, search) with status-aggregated summary; POST create payout (auto-generates payoutRef)
- `src/app/api/payouts/[id]/route.ts` — GET payout detail (with driver/owner recipient), PATCH state-machine transitions: approve, process, mark_paid, mark_failed, reject (with status validation)
- `src/app/api/payouts/recipients/route.ts` — GET drivers & owners list for payout creation (uses payouts.view permission — works for finance_admin without needing drivers.view/owners.view)

### Module Views (6 files)
- `src/components/module/proof-of-play.tsx` — ProofOfPlayView: prominent "Verified Playback — not guaranteed human impressions" info alert; 4 KPI cards (Total Verified Plays, Completion Rate, Failed Plays, Active Devices); filters (campaign, device, status, range today/7d/30d/custom with date pickers); desktop table + mobile cards; completion % progress bars
- `src/components/module/analytics.tsx` — AnalyticsView: 3-tabbed interface (Campaigns / Devices / Network); range toggle (Today/7 Days/30 Days); Campaign tab has stacked bar (scheduled/verified/failed) + table; Device tab has uptime/downtime bar + HealthRow component (signal/temp/storage/RAM progress bars) + device health table; Network tab has plays trend area chart + city-wise stacked bar
- `src/components/module/billing.tsx` — BillingView: KPI cards (Total Billed, Total Paid, Outstanding, Overdue); invoice list (desktop table + mobile cards) with GST 18% columns; detail view with payment history, advertiser info, payment provider integration-ready badge; Create Invoice dialog with live GST+total preview; Record Payment & Refund dialogs (method: upi/bank/card/manual; provider: razorpay/manual)
- `src/components/module/revenue.tsx` — RevenueView: 10 KPI cards (Gross, Platform, Driver, Owner, Net, IoT, Cloud, Maintenance, Payment Fees, Net Margin); 6-month revenue trend area chart (gross + net); revenue breakdown pie (platform/owner/driver/costs); city-wise gross vs net bar; filters (range/city/campaign); transactions table
- `src/components/module/driver-earnings.tsx` — DriverEarningsView: prominent Active Earning Rule banner showing current shares/bonuses; KPI cards (Total Earnings, Base, Revenue Share, Avg Uptime); earnings list; Recalculate dialog (recomputes using active rule — never hardcodes); Earning Rule config dialog (editable when settings.edit permission); Detail view with full breakdown (Base + Revenue Share + Uptime Bonus + Campaign Bonus + Compliance Bonus − Service Penalty = Total), performance metrics, driver info, payment info, approve button
- `src/components/module/payouts.tsx` — PayoutsView: KPI cards (Paid This Month, Pending Approval, Processing, Failed); payout list with status badges + recipient type badges; detail view with payout summary, state-machine action buttons (Approve → Mark Processing → Mark Paid; Mark Failed; Reverse), lifecycle visualization, recipient + payment details, ledger entry card; Create Payout dialog (recipient type toggle, recipient picker via /api/payouts/recipients, amount, month, method)

## Design Decisions
- All API routes check `getCurrentUser()` for auth + `hasPermission()` for RBAC before any DB access
- All mutating routes (POST/PATCH) call `auditLog()` after success
- Used shadcn/ui `Tabs` for Analytics 3-section view; `Dialog` for create/edit/approve flows; `Select` for all dropdowns
- Charts use `recharts` with LakhirAd orange (#f97316) primary + success/info/warning/destructive palette — no indigo/blue
- Tables are responsive: desktop table → mobile cards (pattern from devices.tsx)
- Filters reset page to 1 via inline setter wrappers (avoids `set-state-in-effect` lint rule)
- Proof of Play labeled "Verified Playback" with prominent info alert — never as guaranteed impressions
- Earning engine is CONFIGURABLE: `EarningRule` model fetched from `/api/earning-rules`, never hardcoded; the recalculate endpoint reads `rule.driverShare`, `rule.baseParticipation`, `rule.uptimeBonus`, etc. and applies them
- Payment provider abstraction: `Payment.provider` field supports razorpay/manual; `Payment.method` supports upi/bank_transfer/card/manual — integration-ready without committing to a specific gateway
- Payout state machine enforces valid transitions: pending→approved→processing→paid (or →failed/reversed) — server-side validation prevents invalid jumps
- Created `/api/payouts/recipients` endpoint so finance_admin (who has payouts.view but NOT drivers.view/owners.view) can still create payouts

## RBAC Permissions Used
- `proof_of_play.view` — Proof of Play list
- `analytics.view` — Analytics (all 3 tabs)
- `billing.view`, `billing.create`, `billing.edit` — Billing list/create/patch
- `revenue.view` — Revenue dashboard
- `earnings.view`, `earnings.edit` — Driver earnings list/approve/recalculate
- `settings.edit` — Earning rule updates
- `payouts.view`, `payouts.approve` — Payouts list/create/state transitions

## Lint Status
- All 6 module views and 9 API route files pass ESLint cleanly
- 15 remaining lint errors are in OTHER agents' files (`header.tsx`, `engineers.tsx`, `users.tsx`) — not in scope of this task

## Stage Summary
- All 6 finance/analytics modules functional with full CRUD, filtering, pagination, charts, and RBAC
- Earning engine is fully configurable via /api/earning-rules — no hardcoded payout amounts
- Payment provider integration-ready (Razorpay/manual) via Payment.provider field
- Payout state machine prevents invalid status transitions
- Ready for end-to-end testing once remaining modules (scheduling, inventory, service, roles, notifications, audit, settings, command-center, live-map) are built by other agents
