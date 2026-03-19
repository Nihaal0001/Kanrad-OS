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
2. Orders + Customers (CRUD, per-item style names, size/color breakdown, BOM, dispatch details, duplicate order)
3. Customers & Suppliers (CRUD, GSTIN, bank details, payment terms, credit limit — buyers fully migrated to customers)
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
- Mobile: bottom tab bar with 4 tabs (Home, Production, Finance, More). Sidebar collapses to Sheet overlay on mobile
- Mobile bottom nav defined in `src/components/layout/mobile-bottom-nav.tsx`; "More" tab renders `/more` page with all remaining nav sections
- `mobilePrimaryTabs` and `getMobileMoreSections()` exported from `src/lib/constants.ts`
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
- Migrations run: `00001` through `00007`, `00010`, `00013` through `00021`
- Tables: profiles, orders, order_items, order_materials, material_categories, materials, stock_transactions, purchase_orders, purchase_order_items, production_stages, production_tracking, quality_checks, tasks, notifications, invoices, invoice_items, payments, order_costings, shifts, worker_shifts, attendance, leaves, payroll, expense_categories, expenses, purchase_invoices, purchase_invoice_items, purchase_payments, audit_logs, hsn_master, chart_of_accounts, journal_entries, journal_entry_lines, customers, suppliers, credit_notes, credit_note_items, bank_statement_rows, finance_import_batches, finance_import_items
- NOTE: `buyers` table has been retired from the live schema. `customers` is the canonical contact model

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
- **Roadmap Phase 5 (Demo Polish)**: COMPLETE — customer portal
- **Roadmap Phase 6 (Financial Maturity)**: COMPLETE — credit notes, Tally XML, e-invoice, bank reconciliation
- **AI Finance Import**: COMPLETE — Gemini-powered document intake at `/finance/import`
- **Deploy to Vercel**: NOT STARTED

## Env Vars Required
```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY, SARVAM_API_KEY
RESEND_API_KEY, EMAIL_FROM, OWNER_EMAIL
TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, OWNER_WHATSAPP
CRON_SECRET
```

## Post-Phase 10 Fixes (session 5 — All Modules Complete)

### Features added (Phases 2–6 of ROADMAP.md)
- **Customers & Suppliers**: Full directory CRUD at `/customers` and `/suppliers` with soft-delete
- **Dispatch fields**: `transporter_name`, `lr_number`, `vehicle_number`, `dispatch_date`, `expected_delivery_date` on orders
- **Delivery Challan PDF**: `GET /api/challan/[orderId]/pdf` — A4 PDF via @react-pdf/renderer
- **Packing Slip PDF**: `GET /api/packing-slip/[orderId]/pdf` — A4 PDF via @react-pdf/renderer
- **Duplicate Order**: `duplicateOrder(id)` server action + button in order actions
- **Wastage Tracking**: `quantity_input` + `waste_notes` on production tracking; waste % shown per stage and in aggregate
- **PO Matching**: Purchase invoice detail shows linked PO with ordered vs invoiced comparison, mismatch highlighting
- **Order Margin / P&L**: Order costing page shows revenue from linked invoices, total cost, gross margin %
- **Email alerts (Resend)**: Low stock, overdue invoices, leave request notifications via `src/lib/email.ts`
- **WhatsApp digest (Twilio)**: Daily owner digest via `src/lib/whatsapp.ts`
- **Payslip PDF**: `GET /api/payslip/[id]/pdf` — downloadable from payroll list
- **Cron jobs**: `/api/cron/low-stock-alert`, `/api/cron/overdue-invoices`, `/api/cron/whatsapp-digest` (defined in `vercel.json`)
- **Customer Portal**: `/portal/[orderId]/[token]` — public HMAC-signed read-only order tracker. Token via `src/lib/portal.ts`
- **Credit Notes**: Full CRUD at `/finance/credit-notes` with auto-numbering (CN-YYMMDD-NNN) and invoice linking
- **Tally XML Export**: `GET /api/export/tally-xml?from=&to=` — Tally Prime–compatible voucher XML. Button in Settings
- **E-Invoice JSON (GST IRP)**: `GET /api/einvoice/[id]/json` — GST IRP schema v1.1 payload. Button on invoice detail
- **Bank Reconciliation**: `/finance/bank-recon` — CSV import, auto-match to payments by amount+date, export unmatched
- **AI Finance Import**: `/finance/import` — drag-drop upload of supplier invoices/expense receipts; Gemini (gemini-2.5-flash) extracts supplier name, GST, line items, dates; review UI with fuzzy supplier/PO matching; submits as purchase invoice or expense draft. Batch tracking via `finance_import_batches` + `finance_import_items` tables. Files stored in `finance-documents` Supabase Storage bucket.
- **Audit coverage expanded**: `logAudit()` added to credit note, expense, and purchase invoice mutations
- **Sidebar/mobile nav**: updated to include AI Import link under Finance group

### Sanjeev's additions (session 6)
- **Buyers → Customers migration**: `buyers` table/actions/components fully replaced by `customers`. `src/actions/buyers.ts`, `buyer-form.tsx`, `buyer-select.tsx`, `buyers-table.tsx`, `validators/buyer.ts` all deleted. New: `customer-form.tsx`, `customer-select.tsx`. Orders and finance docs now reference `customer_id` / `customer_name` instead of `buyer_id` / `buyer_name`.
- **Per-item style names**: `order_items.style_name` column added. `orders.style_name` is now auto-computed by DB trigger as a comma-joined distinct list of item style names. `src/lib/order-styles.ts` provides `getOrderStyleSummary()` helper.
- **Mobile bottom navigation**: `mobile-bottom-nav.tsx` — 4-tab bottom bar (Home, Production, Finance, More). "More" tab routes to `/more` page listing all remaining nav sections. `mobilePrimaryTabs`, `getActiveMobileTab()`, `getMobileMoreSections()` added to `src/lib/constants.ts`.
- **AI chat widget**: updated for mobile positioning; `create_buyer` renamed to `create_customer` in WRITE_TOOLS.

### New migrations needed
- `00016_phase5_6.sql` — credit_notes, credit_note_items, bank_statement_rows tables
- `00017_finance_import_ai.sql` — finance_import_batches, finance_import_items tables; adds document_path/document_url to purchase_invoices; creates finance-documents storage bucket
- `00018_order_item_styles.sql` — adds `style_name` to order_items; DB trigger to auto-recompute `orders.style_name`
- `00019_customer_backfill_from_buyers.sql` — backfills buyers → customers and attaches orders to customer rows
- `00020_finance_customer_columns.sql` — adds customer_id/customer_name/customer_address/customer_gst to invoices + credit_notes
- `00021_drop_legacy_buyer_schema.sql` — drops buyer-linked legacy schema and retires the buyers table

### New env vars needed
- `PORTAL_SECRET` — 32+ char random string for HMAC customer portal tokens
- `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL` — Resend email alerts
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `OWNER_WHATSAPP` — WhatsApp digest
- `CRON_SECRET` — Bearer token for Vercel cron security

## Next Steps
1. **Add env vars** to `.env.local` and Vercel dashboard: `PORTAL_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `OWNER_WHATSAPP`, `CRON_SECRET`
2. **Delete** `src/app/api/dev/auth-status/route.ts` before production deploy
3. **Deploy to Vercel** — connect repo, set env vars, add cron config

## Feature Roadmap
All roadmap phases complete. AI Finance Import (Gemini-powered document intake), customer portal, credit notes, Tally XML, e-invoice JSON, and bank reconciliation are all live.

## Multi-Client Strategy
- "Just Clothing" = demo/template for garment manufacturing
- Multi-industry: adapted per client (food, furniture, leather, pharma, etc.) via git branches
- Each client: own Supabase project + Vercel deployment, branched off `main`
- Branding changes: ~15 files with "JUST CLOTHING" + CSS color palette swap
- Bug fixes/features on `main` → merge to client branches
- At 10+ clients: move to `client.config.ts` for zero-code branding
