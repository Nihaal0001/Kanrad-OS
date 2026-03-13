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
- Auto-generated order numbers: JC-ORD-YYMMDD-NNN
- Database triggers for: order confirmation → production rows, stock changes → alerts, stage completion → order status
- All list pages use shared `data-table.tsx` component
- Forms use react-hook-form + zod validation
- Mobile: sidebar collapses to Sheet overlay

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
