# JUST CLOTHING — Garment Manufacturing ERP

## Project Overview
ERP system for a medium-scale (20-100 workers) casual garment manufacturing unit.
Full production cycle: Fabric Sourcing → Cutting → Stitching → Quality Check → Finishing/Ironing → Packing → Dispatch.

## Tech Stack
- **Frontend**: Next.js 15 (App Router) + TypeScript
- **UI**: shadcn/ui + Tailwind CSS
- **Database & Auth**: Supabase (PostgreSQL + RLS + Auth + Realtime + Storage)
- **Deployment**: Vercel
- **Key Libraries**: @tanstack/react-table, react-hook-form, zod, lucide-react, react-day-picker, date-fns, recharts, @react-pdf/renderer, exceljs, resend, twilio

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
- **Double-entry accounting**: DB triggers auto-create journal entries from invoices, payments, expenses, purchase invoices

## Modules
1. Dashboard (KPIs, recent orders, production overview, activity feed)
2. Orders + Buyers (CRUD, size/color breakdown, BOM, dispatch details, duplicate order)
3. Customers & Suppliers (CRUD, GSTIN, bank details, payment terms, credit limit)
4. Inventory (materials, stock ledger, purchase orders, low-stock alerts)
5. Production Tracking (7-stage pipeline, stage updates, wastage tracking, bottleneck detection)
6. Quality (QC inspections, defect tracking, image upload)
7. Tasks (kanban board, assignment, order/stage linking)
8. Notifications (realtime, polymorphic, multi-type alerts)
9. Finance (invoices, payments, per-order costing, expenses, purchase invoices, cash flow, P&L, GST reports, journal/ledger/trial balance)
10. HR (attendance with date nav + status grouping, leaves, shifts, payroll, payslip PDF, QR kiosk)
11. Audit Trail (entity-level logging, filters by module/action/date)
12. User Management (roles, permissions, RLS)
13. AI — KYRE (Sarvam voice chat + Gemini agent with 12 tools, confirmation cards for write ops)
14. Notifications — Email (Resend) + WhatsApp daily digest (Twilio)

## User Roles
Admin/Owner, Production Manager, Inventory Manager, QC Head, Floor Supervisor, Worker

## Key Conventions
- Append-only ledger pattern for stock transactions
- Auto-generated order numbers: JC-ORD-YYMMDD-NNN (via DB trigger)
- Database triggers for: order confirmation → production rows, stock changes → alerts, stage completion → order status, financial transactions → journal entries
- All list pages use shared `data-table.tsx` component
- Forms use react-hook-form + zod validation + `<Controller>` for custom DatePicker/TimePicker
- Custom DatePicker (calendar popover) and TimePicker (dual Select) replace ALL native date/time inputs
- Mobile: sidebar collapses to Sheet overlay
- Server Actions go in `src/actions/<module>.ts`
- Zod validators go in `src/lib/validators/<module>.ts`
- Supabase types go in `src/lib/supabase/types.ts`
- Empty strings are cleaned to `null` before DB insert (in server actions)
- Use `z.number()` with `valueAsNumber: true` in form register (NOT `z.coerce.number()` — broken in Zod v4)
- shadcn components were manually created (CLI unreachable) — they live in `src/components/ui/`
- Migrations are in `supabase/migrations/` — user runs them manually in Supabase SQL Editor
- RLS policies require authenticated users (`auth.uid() IS NOT NULL`)
- Sidebar is collapsible: 260px expanded, 68px collapsed, with tooltips when collapsed
- Auth: `src/lib/supabase/admin.ts` exports `createAdminClient()` using service role key (server-side only)
- Login auto-confirms unconfirmed users on first sign-in (via admin API in login action)
- User profile is fetched in dashboard layout via `profiles.auth_id = auth.uid()` and passed as prop to shell/topbar
- `logAudit()` is fire-and-forget — never blocks main operation, errors are swallowed
- Auth guards (`getUser()`) on all server actions; `requireAdmin()` for admin-only ops
- `EmptyState` action prop takes `{ label, href }` object — NOT JSX elements
- Purchase invoice numbers = supplier's own number (plain text, NOT auto-generated)
- Dark mode in recharts: always use `useTheme` + explicit hex, never CSS variables in SVG attributes
- Dark mode in dynamic badge strings: use border-only Tailwind classes (no `dark:` prefix in JS object values)
- Cron jobs secured with `CRON_SECRET` bearer token

## Supabase
- Project ref: `spwighzxkaeibutmijus`
- Migration files must be run manually by the user in the Supabase SQL Editor
- Migrations run: `00001` through `00007`, `00010`, `00013`, `00014`, `00015`
- Tables: profiles, buyers, orders, order_items, order_materials, material_categories, materials, stock_transactions, purchase_orders, purchase_order_items, production_stages, production_tracking, quality_checks, tasks, notifications, invoices, invoice_items, payments, order_costings, shifts, worker_shifts, attendance, leaves, payroll, expense_categories, expenses, purchase_invoices, purchase_invoice_items, purchase_payments, audit_logs, hsn_master, chart_of_accounts, journal_entries, journal_entry_lines, customers, suppliers

## Known Issues & Quirks
- **Turbopack cache corruption**: If you get `ENOENT: build-manifest.json` errors, run `rm -rf .next && npm run dev`
- **Radix Select**: Never use `value=""` on `<SelectItem>` — use `"none"` as sentinel and map it back
- **Zod v4**: Don't use `required_error` on `z.number()` — it's not valid in Zod v4
- **Supabase joins**: `leaves` table has two FKs to `profiles` (worker_id, approved_by) — must use `profiles!worker_id` hint
- **Production trigger fires on UPDATE only**: The `on_order_confirmed` trigger only fires on status UPDATE, not INSERT. Fixed in code: `getOrderProduction` auto-creates tracking rows on first load if none exist.
- **Trial balance**: Uses JS-side date filtering (Supabase limitation: can't filter on joined table columns in nested select)

## Current Status
- **Core ERP (Phases 1-10)**: COMPLETE — all modules built and functional
- **Finance Upgrade**: COMPLETE — expenses, purchase invoices, cash flow, P&L, GST reports, journal/ledger/trial balance, Excel exports
- **Roadmap Phase 1 (Trust & Compliance)**: COMPLETE — audit trail, HSN codes, data export, double-entry accounting
- **Roadmap Phase 2 (Daily Operations)**: COMPLETE — customers/suppliers, delivery challan, packing slip, dispatch details, duplicate order
- **Roadmap Phase 3 (Inventory & Costing)**: COMPLETE — wastage tracking, PO↔purchase invoice matching, enhanced order costing with margin
- **Roadmap Phase 4 (Notifications)**: COMPLETE — email (Resend), WhatsApp digest (Twilio), payslip PDF
- **Roadmap Phase 5 (Demo Polish)**: NOT STARTED — buyer portal
- **Roadmap Phase 6 (Financial Maturity)**: NOT STARTED — credit notes, Tally XML, e-invoice, bank reconciliation
- **Deploy to Vercel**: NOT STARTED

## Env Vars Required
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY, SARVAM_API_KEY
RESEND_API_KEY, EMAIL_FROM, OWNER_EMAIL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OWNER_WHATSAPP
CRON_SECRET
```

## Next Steps
1. **Delete** `src/app/api/dev/auth-status/route.ts` before production deploy
2. **Roadmap Phase 5** — Buyer portal (token-based read-only order status)
3. **Deploy to Vercel** — connect repo, set env vars, add cron config

## Feature Roadmap
Full details in `docs/ROADMAP.md`. Remaining:
- **Phase 5 — Demo Polish**: Buyer portal (token-based read-only order status)
- **Phase 6 — Financial Maturity**: Credit notes/returns, Tally XML export, e-invoice (GST portal), bank reconciliation

## Multi-Client Strategy
- "Just Clothing" = demo/template for garment manufacturing
- Multi-industry: adapted per client (food, furniture, leather, pharma, etc.) via git branches
- Each client: own Supabase project + Vercel deployment, branched off `main`
- Branding changes: ~15 files with "JUST CLOTHING" + CSS color palette swap
- Bug fixes/features on `main` → merge to client branches
- At 10+ clients: move to `client.config.ts` for zero-code branding
