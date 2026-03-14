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
- Auth is set up LAST (Phase 8), after all modules are built
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
- RLS is enabled with permissive "allow all" policies until Phase 8
- Sidebar is collapsible: 260px expanded, 68px collapsed, with tooltips when collapsed

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
- **Phase 8**: DEFERRED — Auth + RLS + Roles (skipped for now; focusing on UX polish + AI prep instead)
- **Phase 9**: IN PROGRESS — UX/UI polish, then deploy

## Supabase
- Project ref: `spwighzxkaeibutmijus`
- Migration files must be run manually by the user in the Supabase SQL Editor
- Migrations run: `00001` through `00006` (Phases 1–7, all complete)
- Tables created so far: profiles, buyers, orders, order_items, order_materials, material_categories, materials, stock_transactions, purchase_orders, purchase_order_items, production_stages, production_tracking, quality_checks, tasks, notifications, invoices, invoice_items, payments, order_costings, shifts, worker_shifts, attendance, leaves, payroll

## Known Issues & Quirks
- **Turbopack cache corruption**: If you get `ENOENT: build-manifest.json` errors, run `rm -rf .next && npm run dev`
- **Radix Select**: Never use `value=""` on `<SelectItem>` — use `"none"` as sentinel and map it back
- **Zod v4**: Don't use `required_error` on `z.number()` — it's not valid in Zod v4
- **Supabase joins**: `leaves` table has two FKs to `profiles` (worker_id, approved_by) — must use `profiles!worker_id` hint
- **No auth yet**: HR module uses `profiles` table directly. Insert test rows manually in Supabase SQL Editor

## Next Steps (UX Polish — decided by Sanjeev)
Instead of Phase 8 (Auth), the next work is UX/UI improvements:
1. **Toast notifications** — feedback on form submissions (use sonner or shadcn toast)
2. **Breadcrumbs** — add to all detail/nested pages
3. **Command palette (⌘K)** — global search across orders, materials, workers
4. **Dashboard quick actions** — shortcuts to common tasks (Create Order, Mark Attendance, etc.)
5. **Clickable KPIs** — dashboard stat cards link to filtered views
6. **Date filters** — on HR attendance/payroll pages
7. **Settings page** — basic organization info instead of "coming soon"
8. **AI integration** — future plan to add AI features (command palette → AI chat, dashboard → AI insights)
