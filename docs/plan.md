# JUST CLOTHING — Garment Manufacturing ERP

## Context

Building a complete ERP system for a medium-scale (20-100 workers) casual garment manufacturing unit. The unit follows a full production cycle: Fabric Sourcing → Cutting → Stitching → Quality Check → Finishing/Ironing → Packing → Dispatch. The ERP needs to feel premium and industry-specific — minimal yet warm, not generic like Zoho/Odoo. Authentication is deliberately deferred to the final phase to maximize development velocity.

**Tech Stack**: Next.js 15 (App Router) · Supabase (Postgres + Auth + Realtime + Storage) · Vercel · shadcn/ui + Tailwind CSS
**Brand**: JUST CLOTHING

---

## Design System

**Color Palette** (HSL values for CSS custom properties):
- Background: warm cream `hsl(30, 25%, 97%)`
- Foreground: dark warm brown `hsl(25, 20%, 15%)` (never pure black)
- Primary: terracotta `hsl(16, 65%, 55%)`
- Secondary: warm tan `hsl(30, 15%, 92%)`
- Accent: warm gold `hsl(35, 40%, 75%)`
- Borders: warm gray `hsl(30, 15%, 88%)`
- Border radius: `0.625rem` (softer than default shadcn)

**Fonts**: `Inter` for UI, `DM Serif Display` for the brand mark only.

**Status Colors**: Terracotta (urgent/blocked), Amber (in-progress), Sage green (completed), Warm gray (draft/pending).

---

## User Roles & Permissions

| Role | Access |
|------|--------|
| Admin/Owner | Full access to everything |
| Production Manager | Orders, production, tasks (read/write); inventory (read) |
| Inventory Manager | Materials, stock, purchase orders (full); orders (read) |
| QC Head | Quality checks (full); orders, production (read) |
| Floor Supervisor | Tasks, attendance, production updates (read/write) |
| Worker | Own tasks (read), own attendance (read/write) |

---

## Database Schema

### Core Tables (Migration 00001 — DONE)
- **`profiles`** — extends auth.users (id, full_name, role, department, phone, avatar_url, is_active)
- **`buyers`** — buyer/client info (name, company, email, phone, address, gst_number)
- **`orders`** — order_number (JC-ORD-YYMMDD-NNN), buyer_id, style_name, total_quantity, deadline, priority, status (draft→confirmed→in_production→completed→dispatched→cancelled)
- **`order_items`** — per-order size/color breakdown (size, color, quantity, unit_price)
- **`order_materials`** — bill of materials per order (material_id, quantity_required, quantity_allocated)

### Inventory Tables (Migration 00002 — DONE)
- **`material_categories`** — Fabric, Trims, Accessories, Thread, Labels, Packaging
- **`materials`** — sku, name, category_id, unit, current_stock, min_stock_level, cost_per_unit, supplier info, location
- **`stock_transactions`** — append-only ledger (material_id, type: purchase_in/production_out/adjustment/return, quantity, reference)
- **`purchase_orders`** + **`purchase_order_items`** — PO management with receiving

### Production Tables (Migration 00003 — TODO)
- **`production_stages`** — reference table with 7 stages (sequence 1-7)
- **`production_tracking`** — per order per stage (status, quantity_completed, quantity_rejected, assigned_to, timestamps)
- **`quality_checks`** — inspection results (quantity inspected/passed/failed, defect_type, severity, images)

### Task & Notification Tables (Migration 00004 — TODO)
- **`tasks`** — title, order_id (optional), stage_id (optional), assigned_to, priority, status (todo→in_progress→done)
- **`notifications`** — polymorphic (type, reference_id, reference_type, is_read)

### Finance Tables (Migration 00005 — TODO)
- **`invoices`** + **`invoice_items`** — invoice generation from completed orders
- **`payments`** — payment recording (amount, method, reference)
- **`order_costings`** — material/labor/overhead/other costs with generated total_cost column

### HR Tables (Migration 00006 — TODO)
- **`attendance`** — daily check-in/out, status, overtime_hours (unique per worker+date)
- **`leaves`** — leave requests with approval workflow
- **`shifts`** + **`worker_shifts`** — shift definitions and assignments
- **`payroll`** — period-based wage calculation (base + overtime - deductions + bonus)

### Database Triggers
1. `generate_order_number()` — auto-generate JC-ORD-YYMMDD-NNN format (DONE)
2. `on_stock_transaction_insert()` — update materials.current_stock (DONE)
3. `generate_po_number()` — auto-generate JC-PO-YYMMDD-NNN format (DONE)
4. `recalculate_po_total()` — auto-update PO total when items change (DONE)
5. `on_order_confirmed()` — auto-create 7 production_tracking rows (TODO)
6. `on_production_stage_complete()` — check if all stages done, update order status (TODO)

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx, globals.css
│   ├── (auth)/login/page.tsx                    # Phase 8
│   └── (dashboard)/
│       ├── layout.tsx                           # Sidebar + topbar shell
│       ├── page.tsx                             # Dashboard
│       ├── orders/  (page, new, [id], [id]/edit)
│       ├── inventory/  (page, new, [id], purchase-orders/...)
│       ├── production/  (page, [orderId])
│       ├── quality/  (page, new)
│       ├── tasks/  (page, new)
│       ├── finance/  (invoices/, costing/, payments/)
│       ├── hr/  (attendance, leaves, payroll, shifts)
│       ├── notifications/page.tsx
│       └── settings/  (page, users)
├── components/
│   ├── ui/              # shadcn/ui primitives
│   ├── layout/          # sidebar, topbar, mobile-nav, breadcrumbs
│   ├── shared/          # data-table, stat-card, status-badge, page-header, empty-state, etc.
│   ├── orders/          # order-form, order-card, order-timeline, order-items-table
│   ├── inventory/       # material-form, stock-level-bar, low-stock-alert
│   ├── production/      # production-pipeline, stage-card, qc-form
│   ├── tasks/           # task-form, task-card, task-board
│   ├── finance/         # invoice-form, invoice-preview, costing-breakdown
│   └── hr/              # attendance-form, attendance-calendar, payroll-table
├── actions/             # Server Actions (orders, inventory, production, tasks, finance, hr, notifications)
├── hooks/               # use-realtime, use-notifications, use-user, use-debounce
└── lib/
    ├── supabase/        # client.ts, server.ts, middleware.ts, types.ts
    ├── constants.ts
    ├── utils.ts
    └── validators/      # Zod schemas per module
```

---

## Data Fetching Architecture

- **Reads**: Server Components fetch directly from Supabase via `createServerClient`
- **Mutations**: Next.js Server Actions in `src/actions/` → Supabase → `revalidatePath()`
- **Realtime**: `use-realtime` hook for notifications, production pipeline, dashboard
- **Filters/Search**: URL search params (bookmarkable, shareable)
- **State**: No global store. React Context only for user profile + sidebar toggle

---

## Implementation Phases

### Phase 1: Foundation ✅
- Initialize Next.js 15 + TypeScript + Tailwind + shadcn/ui
- Configure warm color palette in `globals.css`
- Build layout shell: sidebar (260px desktop, Sheet on mobile), topbar (search, notifications, user menu)
- Build shared components: `data-table` (with @tanstack/react-table), `stat-card`, `status-badge`, `page-header`, `empty-state`, `loading-skeleton`
- Static placeholder dashboard

### Phase 2: Orders + Buyers ✅
- Migration: profiles, buyers, orders, order_items
- Buyers CRUD
- Orders list (data-table with status/priority filters)
- Order create form (dynamic size/color breakdown with add/remove rows)
- Order detail + edit pages
- Server actions for all CRUD

### Phase 3: Inventory ✅
- Migration: material_categories, materials, stock_transactions, purchase_orders, purchase_order_items
- Materials list with stock-level visual bars
- Material create/edit + detail with transaction history
- Stock adjustment form
- Low-stock alerts
- Purchase orders CRUD with line items and receiving workflow

### Phase 4: Production + Quality ⬜ NEXT
- Migration: production_stages, production_tracking, quality_checks
- Seed 7 stages
- Auto-create tracking rows on order confirmation (trigger)
- Production pipeline page (horizontal connected nodes showing all active orders across stages)
- Per-order production detail with stage update forms
- QC entry form (pass/fail counts, defect type, image upload)
- QC reports list
- Connect production completion → order status update
- Order detail timeline component

### Phase 5: Tasks + Notifications + Dashboard ⬜
- Migration: tasks, notifications
- Task kanban board (todo/in_progress/done columns)
- Task CRUD with order/stage linking
- Notification triggers (deadline, low stock, QC failure, stage complete, task assigned)
- Notification bell with realtime subscription
- Notifications list page
- Live dashboard with KPIs: active orders, due this week, completion %, low stock count, revenue
- Recent activity feed

### Phase 6: Finance ⬜
- Migration: invoices, invoice_items, payments, order_costings
- Invoice creation from completed orders (pre-fill from order items)
- Invoice list + detail with print-ready layout
- Payment recording + tracking
- Per-order costing page (auto material cost + manual labor/overhead)

### Phase 7: HR ⬜
- Migration: attendance, leaves, shifts, worker_shifts, payroll
- Attendance marking (date grid) + calendar view per worker
- Leave request + approval workflow
- Shift management (define + assign)
- Payroll calculation (attendance → base + overtime - deductions)

### Phase 8: Authentication + RLS + Roles ⬜
- Supabase Auth (email/password)
- Login page + auth middleware
- Profile auto-creation trigger
- User management page (admin only): invite, assign role, activate/deactivate
- RLS policies on all tables (role-based)
- Role-based sidebar filtering
- Server action role checks (defense-in-depth)

### Phase 9: Polish + Deploy ⬜
- Loading states + error boundaries on all pages
- Mobile responsiveness pass
- Seed script with realistic demo data
- Vercel deployment + env vars
- Final testing

---

## Verification Plan

1. **After Phase 1**: Sidebar navigates between placeholder pages, responsive on mobile, warm theme visible
2. **After Phase 2**: Create a buyer, create an order with size/color items, view in list, edit, verify data persists in Supabase
3. **After Phase 3**: Add materials, perform stock transactions, verify current_stock updates, verify low-stock alerts trigger
4. **After Phase 4**: Confirm an order → verify 7 tracking rows created. Update stages → verify pipeline view reflects changes. Submit QC → verify pass/fail counts
5. **After Phase 5**: Assign a task → verify notification appears. Check dashboard KPIs match actual data. Verify realtime updates (open two tabs)
6. **After Phase 6**: Create invoice from order → verify amounts. Record payment → verify status updates
7. **After Phase 7**: Mark attendance → verify payroll calculation. Submit leave → verify approval flow
8. **After Phase 8**: Login as different roles → verify sidebar shows only permitted sections. Verify RLS blocks unauthorized data access
9. **After Phase 9**: Test on mobile, verify Vercel deployment works end-to-end
