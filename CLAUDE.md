# JUST CLOTHING — Garment Manufacturing ERP

## Project Overview
ERP system for a medium-scale (20-100 workers) casual garment manufacturing unit.
Full production cycle: Fabric Sourcing → Cutting → Stitching → Quality Check → Finishing/Ironing → Packing → Dispatch.

## Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL + RLS + Auth + Realtime + Storage)
- **Deployment**: Vercel
- **Key Libraries**: @tanstack/react-table, react-hook-form, zod, lucide-react

## Design System
- **Style**: Minimal + warm/crafted — clean whitespace (Linear/Notion-inspired) with earthy tones
- **Primary**: Terracotta `hsl(16, 65%, 55%)`
- **Background**: Warm cream `hsl(30, 25%, 97%)`
- **Foreground**: Dark warm brown `hsl(25, 20%, 15%)` — never pure black
- **Accent**: Warm gold `hsl(35, 40%, 75%)`
- **Fonts**: Inter (UI), DM Serif Display (brand mark only)
- **Border radius**: 0.625rem (softer than default shadcn)
- **Status colors**: Terracotta (urgent), Amber (in-progress), Sage green (completed), Warm gray (draft)

## Architecture
- **Data fetching**: Server Components + Supabase `createServerClient`
- **Mutations**: Next.js Server Actions → Supabase → `revalidatePath()`
- **Realtime**: Supabase Realtime subscriptions for notifications, production, dashboard
- **State**: No global store. React Context for user profile + sidebar toggle only
- **Filters**: URL search params (bookmarkable)

## Modules
1. Dashboard (KPIs, recent orders, production overview, activity feed)
2. Orders + Buyers (CRUD, size/color breakdown, BOM)
3. Inventory (materials, stock ledger, purchase orders, low-stock alerts)
4. Production Tracking (7-stage pipeline, stage updates, bottleneck detection)
5. Quality (QC inspections, defect tracking, image upload)
6. Tasks (kanban board, assignment, order/stage linking)
7. Notifications (realtime, polymorphic, multi-type alerts)
8. Finance (invoices, payments, per-order costing)
9. HR (attendance, leaves, shifts, payroll)
10. User Management (roles, permissions, RLS)

## User Roles
Admin/Owner, Production Manager, Inventory Manager, QC Head, Floor Supervisor, Worker

## Key Conventions
- Append-only ledger pattern for stock transactions
- Auto-generated order numbers: JC-ORD-YYMMDD-NNN (via DB trigger)
- Database triggers for: order confirmation → production rows, stock changes → alerts, stage completion → order status
- All list pages use shared `data-table.tsx` component
- Forms use react-hook-form + zod validation
- Mobile: sidebar collapses to Sheet overlay
- Server Actions go in `src/actions/<module>.ts`
- Zod validators go in `src/lib/validators/<module>.ts`
- Supabase types go in `src/lib/supabase/types.ts`
- Empty strings are cleaned to `null` before DB insert (in server actions)
- Use `z.number()` with `valueAsNumber: true` in form register (NOT `z.coerce.number()` — broken in Zod v4)
- shadcn components were manually created (CLI unreachable) — they live in `src/components/ui/`
- Migrations are in `supabase/migrations/` — user runs them manually in Supabase SQL Editor
- RLS policies require authenticated users (`auth.uid() IS NOT NULL`) — updated in Phase 8
- Sidebar is collapsible: 260px expanded, 68px collapsed, with tooltips when collapsed
- Auth: `src/lib/supabase/admin.ts` exports `createAdminClient()` using service role key (server-side only)
- Login auto-confirms unconfirmed users on first sign-in (via admin API in login action)
- User profile is fetched in dashboard layout via `profiles.auth_id = auth.uid()` and passed as prop to shell/topbar

## Build Order
Phase 1: Foundation (layout, shared components, theme)
Phase 2: Orders + Buyers
Phase 3: Inventory
Phase 4: Production + Quality
Phase 5: Tasks + Notifications + Dashboard (live)
Phase 6: Finance
Phase 7: HR
Phase 8: Auth + RLS + Roles
Phase 9: Polish + Deploy

## Current Status
- **Phase 1**: COMPLETE — layout shell, sidebar, topbar, mobile nav, 19 UI primitives, 6 shared components, warm theme, 14 placeholder pages
- **Phase 2**: COMPLETE — buyers CRUD, orders CRUD with size/color breakdown, order detail/edit, status transitions, delete. Migration: `00001_core_tables.sql`
- **Phase 3**: COMPLETE — materials CRUD with stock level bars, stock adjustment form (append-only ledger), purchase orders CRUD with item receiving workflow, low-stock filter. Migration: `00002_inventory_tables.sql`
- **Phase 4**: COMPLETE — 7-stage production pipeline, per-order stage updates, QC inspections with pass/fail tracking. Migration: `00003_production_tables.sql`
- **Phase 5**: COMPLETE — task kanban board, notifications list + bell badge, live dashboard KPIs + recent orders/activity. Migration: `00004_tasks_notifications.sql`
- **Phase 6**: COMPLETE — invoice creation from orders (auto-fills items/buyer), invoice detail with print layout, payment recording (auto-updates paid status), order costing with computed material cost. Migration: `00005_finance_tables.sql`
- **Phase 7**: COMPLETE — attendance marking (with status/check-in/check-out/OT), leave requests + approve/reject workflow, shift CRUD, payroll generation (auto-fills from attendance summary), mark paid. Migration: `00006_hr_tables.sql`
- **Phase 8**: COMPLETE — Supabase Auth (email/password), middleware route protection, login page, auto-confirm on first login, user profile in topbar (name + role + initials), working logout. Migration: `00007_auth_rls.sql` (⚠️ must still be run in Supabase SQL Editor)
- **Phase 9**: COMPLETE — Toast notifications (sonner, all 16 forms), breadcrumbs (all detail pages), command palette (⌘K, searches orders/materials/workers), dashboard clickable KPIs + Quick Actions, HR date filters (attendance by date, payroll by month), settings page (org info, DB details, module status)
- **Phase 10**: COMPLETE — AI integration (Sarvam voice chat widget, Gemini insights on dashboard, smart suggestions in command palette). AI keys: `GEMINI_API_KEY`, `SARVAM_API_KEY` in `.env.local`
- **Phase 11**: NOT STARTED — Deploy to Vercel
- **Finance Upgrade**: IN PROGRESS — see Finance Upgrade section below

## Supabase
- Project ref: `spwighzxkaeibutmijus`
- Migration files must be run manually by the user in the Supabase SQL Editor
- Migrations run: `00001` through `00006` confirmed. `00007_auth_rls.sql` written but **not yet run**
- `00013_finance_upgrade.sql` written but **not yet run** — adds 5 new tables for Finance Upgrade
- Tables: profiles, buyers, orders, order_items, order_materials, material_categories, materials, stock_transactions, purchase_orders, purchase_order_items, production_stages, production_tracking, quality_checks, tasks, notifications, invoices, invoice_items, payments, order_costings, shifts, worker_shifts, attendance, leaves, payroll
- Finance upgrade tables (pending migration): expense_categories, expenses, purchase_invoices, purchase_invoice_items, purchase_payments

## Known Issues & Quirks
- **Turbopack cache corruption**: If you get `ENOENT: build-manifest.json` errors, run `rm -rf .next && npm run dev`
- **Radix Select**: Never use `value=""` on `<SelectItem>` — use `"none"` as sentinel and map it back
- **Zod v4**: Don't use `required_error` on `z.number()` — it's not valid in Zod v4
- **Supabase joins**: `leaves` table has two FKs to `profiles` (worker_id, approved_by) — must use `profiles!worker_id` hint
- **Migration 00007 not run**: `auth_id` column doesn't exist yet on profiles. Dashboard falls back gracefully (shows email as name) but run the migration to get proper profile data
- **Dev diagnostic route**: `src/app/api/dev/auth-status/route.ts` exists for debugging — delete before deploying to production
- **Production trigger fires on UPDATE only**: The `on_order_confirmed` trigger only fires on status UPDATE, not INSERT. Orders created directly as "confirmed" won't auto-get tracking rows from the trigger. Fixed in code: `getOrderProduction` now auto-creates tracking rows on first load if none exist.

## Post-Phase 10 Fixes (session 3)
- **Security audit**: Auth guards (`getUser()`) added to all server actions — orders, buyers, production, tasks, finance, hr, notifications, inventory, ai, users
- **Admin guard**: `requireAdmin()` helper in `users.ts` checks `profiles.role === "admin"` via `auth_id`
- **Status allowlists**: `VALID_ORDER_STATUSES`, `VALID_TASK_STATUSES`, `VALID_INVOICE_STATUSES`, `VALID_PO_STATUSES` added
- **CSP header**: Content-Security-Policy added to `next.config.ts` allowlisting Supabase, Gemini, Sarvam
- **Hydration fix**: `suppressHydrationWarning` on `<html>` in `layout.tsx` fixes next-themes mismatch
- **Order redirect**: After creating an order, redirects to `/orders` list (not detail page)
- **Quick Actions UI**: "New Purchase Order" button label no longer overflows its grid cell
- **Inventory seed**: `supabase/seeds/inventory_seed.sql` — 25 materials across 5 categories (Fabric, Trims, Thread, Labels, Packaging)
- **AI insights visibility**: Card now has solid amber tint + border; insight rows on white with colour borders
- **AI insights 404**: Links from AI insights validated against known routes before rendering — invalid hrefs hidden
- **Production — auto-init**: `getOrderProduction` auto-creates 7 tracking rows on first load if order has none
- **Production — inline forms**: Production detail page rebuilt with summary stats, progress bar, and inline per-stage update forms (no dialogs)
- **Production — Log Production button**: Pipeline list view now has a "Log Production" button per order row
- **Sidebar**: Quality removed from nav; accessible at `/quality` directly

## Post-Phase 10 Fixes (session 4)

### QR Kiosk improvements
- **Back button**: Kiosk page has a back button (top-left, `router.back()`)
- **Pause when hidden**: `visibilitychange` event stops QR token polling + clears stale QR when tab is hidden; resumes immediately on visibility

### KYRE — AI Agent Mode
- **Agent Mode toggle**: Wand icon in chat widget header switches between KYRE chat (Sarvam) and KYRE Agent (Gemini function calling)
- **New files**: `src/lib/ai/agent.ts` (Gemini tool declarations + multi-turn loop), `src/actions/ai-agent.ts` (`askAgent`, `executeAgentTool`)
- **12 tools**: 6 read (attendance, orders, production, leaves, stock, workers) + 6 write (mark_attendance, approve/reject_leave, create_task, update_task_status, update_production_stage)
- **Confirmation cards**: Write tools show a blue confirmation card before executing; read tools execute immediately and feed results back to Gemini in a loop
- **Conversation history**: Agent passes last 6 messages as Gemini chat history for multi-turn context
- **Naming**: Assistant renamed to **KYRE** throughout (chat header, system prompts, aria labels)
- **Cost**: Runs on Gemini free tier (1,500 req/day) — $0 additional cost

### Invoice PDF export
- **Direct download**: "Save as PDF" button generates a real PDF server-side via `@react-pdf/renderer` and downloads it directly — no print dialog
- **API route**: `GET /api/invoice/[id]/pdf` — auth-gated, streams PDF buffer
- **Template**: `src/components/finance/invoice-pdf.tsx` — A4, professional layout with terracotta branding, org details from Settings, itemized table, GST breakdown, footer
- **Dedicated print route**: `src/app/print/invoice/[id]/` also exists for browser-based print fallback

### Auth fix (from friend's commit)
- `getUserByEmail` doesn't exist in Supabase Admin API — replaced with `listUsers()` + `.find()` in `src/app/auth/login/actions.ts`

## Next Steps
1. **Run migration `00007_auth_rls.sql`** in Supabase SQL Editor (adds auth_id, trigger, proper RLS)
2. **Run migration `00010_qr_attendance.sql`** in Supabase SQL Editor (QR attendance logs table)
3. **Run migration `00013_finance_upgrade.sql`** in Supabase SQL Editor (expense_categories, expenses, purchase_invoices, purchase_invoice_items, purchase_payments)
4. **Create `receipts` storage bucket** in Supabase dashboard (for expense receipt uploads)
5. **Delete** `src/app/api/dev/auth-status/route.ts` before production deploy
6. **Phase 11** — Deploy to Vercel

## Finance Upgrade (In Progress)
Goal: full financial visibility for owner + CA-ready exports + AI expense anomaly detection. NOT a full accounting system — no general ledger, no double-entry.

### Completed
- **Migration** `supabase/migrations/00013_finance_upgrade.sql` — 5 new tables with RLS, triggers, 8 default expense categories
- **Expense tracking** — validator, actions (`src/actions/expenses.ts`), components (expense-form, expense-category-dialog, expense-actions), pages (`/finance/expenses`, `/finance/expenses/new`). Order-wise expense tagging supported.
- **Purchase invoices** — validator, actions (`src/actions/purchase-invoices.ts`), components (purchase-invoice-form with full GST/IGST support, purchase-invoice-actions, purchase-payment-form), pages (`/finance/purchases`, `/finance/purchases/new`, `/finance/purchases/[id]`), cron (`/api/cron/purchase-invoice-overdue`)
- **Finance dashboard** (`/finance`) — Revenue/Outstanding/Expenses/Net Profit (this month) stat cards, Receivables + Payables aging buckets (drafts excluded), Cash Flow chart (recharts), Inventory valuation, Audit readiness progress bar. Actions: `src/actions/finance-reports.ts`
- **Finance reports** (`/finance/reports`) — 4 tabs (P&L, GST Summary, Receivables, Payables), month + Financial Year selectors (Indian FY Apr–Mar, last 4 FYs, mutually exclusive URL params), per-tab CSV/Excel export. `getProfitLoss` and `getGSTSummary` take `start`/`end` strings (not `month`)
- **Cash flow page** (`/finance/cash-flow`) — 12-month statement with stat cards, area chart, detailed table (sales receipts / purchase payments / expenses / net / running total). Each row links to month detail.
- **Cash flow month detail** (`/finance/cash-flow/[month]`) — per-transaction breakdown: Sales Receipts, Purchase Payments, Expenses cards with individual line items, payment method badges (border-only for dark mode compatibility)
- **Export utilities** — `src/lib/export.ts` (arrayToCSV, downloadCSV, downloadExcel, downloadExcelStyled with exceljs), `src/components/finance/export-button.tsx`. `xlsx@0.18.5` + `exceljs@4.4.0` installed.
- **Sidebar** — Finance group has 8 items: Overview, Sales, Purchases, Expenses, Payments, Cash Flow, Costing, Reports

### Bug fixes applied
- Cash flow chart: `useTheme` hook for explicit hex colors in dark mode (recharts SVG doesn't inherit CSS variables)
- Payment method badges: border-only styling (`border border-blue-500 text-blue-500`) — no `dark:` in dynamic JS strings
- `revalidatePath("/finance")` and `revalidatePath("/finance/cash-flow")` added to all payment/expense mutations
- Receivables aging excludes draft invoices (both Overview and Reports)
- COGS in `getProfitLoss` filtered by `created_at` within selected period (was all-time)
- Net profit card on Overview labelled "This month" and uses current-month invoiced revenue (matches P&L report)

### Remaining
- **Phase 5 (partial)**: Add ExportButton to invoices, payments, expenses, purchases list pages
- **Phase 6**: 5 KYRE read-only finance tools in `agent.ts` (get_invoices, get_receivables_summary, get_expenses_summary, get_gst_summary, get_profit_loss) + execute cases + TOOL_PERMISSIONS; expense anomaly detection in `context.ts`
- **Phase 7**: `notifications-list.tsx` add `purchase_invoice_overdue` type; `vercel.json` add purchase-invoice-overdue cron; `types.ts` new finance types

### Key Conventions for Finance Upgrade
- Purchase invoice numbers = supplier's own number (plain text, NOT auto-generated)
- Expense categories: 8 seeded defaults (`is_default=true`) + admin can add custom; `ON DELETE RESTRICT` prevents deleting categories with expenses
- IGST auto-detection: compare first 2 digits of buyer/supplier GSTIN with org state code
- Audit readiness = % of expenses + purchase invoices that have receipt/document URLs
- `xlsx` lazy-imported in `downloadExcel`; `exceljs` used in `downloadExcelStyled` for styled multi-sheet exports
- Dark mode in recharts: always use `useTheme` + explicit hex, never CSS variables in SVG attributes
- Dark mode in dynamic badge strings: use border-only Tailwind classes (no `dark:` prefix in JS object values)
