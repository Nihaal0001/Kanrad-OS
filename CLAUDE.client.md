# KANRAD ERP — Client Branch

> This file is branch-local (`client/kanrad-erp`) and never merges into `main`.
> For platform conventions, tech stack, and shared architecture see `CLAUDE.md`.

## Client Overview
- **Company**: Kanrad ERP
- **Industry**: Houseware manufacturing (cookware, kitchenware, storage, home products)
- **Location**: India
- **Business**: Manufacture houseware products from raw materials → sell to distributors/retailers
- **Branch**: `client/kanrad-erp`
- **Supabase project**: (fill in project ref)
- **Dev port**: 3002 (`npm run dev -- --hostname 0.0.0.0 --port 3002`)

## Branch Identity
- **Brand**: KANRAD ERP
- **Short name**: KH
- **Document prefixes**: `KH-ORD` (work orders), `KH-INV` (invoices), `KH-PO` (purchase orders), `KH-DC` (delivery challan)
- **Primary color**: Navy Blue `hsl(224 73% 38%)` / `#1a3aaa`
- **Accent**: Red `hsl(0 75% 44%)` / `#cc1111` (from Kanrad logo)
- **Config file**: `src/lib/client.config.ts`

## Workflow
`Sales order received → Raw material check (BOM) → Purchase material if needed → Production batch created → Cutting/Pressing → Forming/Assembly → Surface Treatment → QC Inspection → Packing → Dispatch → Invoice → Payment`

### Key Business Rules
- Every work order triggers a **BOM explosion** — system checks stock vs. required materials
- Production is **batch-based** (one batch per work order, batch qty = order qty)
- **Surface treatment** (polishing/coating) is a mandatory stage before QC
- QC must pass before packing is allowed — enforced at DB level
- Dispatch generates a **delivery challan** (KH-DC-YYMMDD-NNN)
- Invoice is raised after dispatch — linked to delivery challan
- **GST**: Manufacturing unit — CGST+SGST for intra-state, IGST for inter-state
- Finished goods stock auto-incremented on batch completion, decremented on dispatch

## Modules In Use (vs Template)

| Module | Status | Notes |
|--------|--------|-------|
| Dashboard | ✓ Keep | Adapt KPIs: active batches, pending dispatch, low stock |
| Orders | ✓ Rename → Work Orders | BOM-linked, batch triggers on confirm |
| Customers | ✓ Keep | Distributors/retailers |
| Suppliers | ✓ Keep | Raw material suppliers |
| Inventory | ✓ Keep | Both raw materials + finished goods |
| Purchase Orders | ✓ Keep | Raw material procurement |
| Production | ✓ Adapt | 7 stages (see below) |
| Quality | ✓ Keep | QC gate before packing |
| BOM | ✓ New module | Not in template — build fresh |
| Finance | ✓ Keep | Full module |
| HR | ✓ Keep | Factory floor workers |
| Tasks | ✓ Keep | Production tasks |
| Notifications | ✓ Keep | Low stock, overdue orders |
| AI (KYRE) | ✓ Keep | Adapt tools for houseware |
| Audit Trail | ✓ Keep | |
| User Management | ✓ Keep | |
| Logistics | ✓ Adapt | Delivery challan + dispatch tracking |

## Production Stages (7)
1. `raw_material_receipt` — Raw materials received and allocated to batch
2. `cutting_pressing` — Sheet metal / plastic cutting and pressing
3. `forming_shaping` — Forming, deep drawing, or injection moulding
4. `assembly_welding` — Component assembly, spot/arc welding, riveting
5. `surface_treatment` — Polishing, powder coating, anodizing, plating
6. `quality_check` — Final QC inspection (pass/fail gate)
7. `packing` — Packing into retail/export packaging, labelling

## Branch-Specific Tables (New — Not in Template)

```sql
-- Bill of Materials header
bom_headers (id, product_sku, product_name, category, version, is_active, notes, created_at)

-- BOM line items
bom_items (id, bom_id FK bom_headers, material_id FK materials, qty_required, unit, wastage_pct, notes)

-- Finished goods inventory (separate from raw material stock)
finished_goods (id, product_sku, product_name, category, qty_on_hand, unit, reorder_level, created_at)

-- Finished goods ledger (append-only, same pattern as stock_transactions)
finished_goods_transactions (id, product_sku, txn_type [in|out|adjust], qty, ref_type, ref_id, notes, created_at)
```

## Existing Tables — Modifications Needed

| Table | Change |
|-------|--------|
| `orders` | Add `bom_id`, `batch_id`, rename order number trigger to `KH-ORD-YYMMDD-NNN` |
| `production_stages` | Seed with 7 Kanrad stages (replace garment stages) |
| `production_tracking` | Add `batch_qty`, `output_qty` columns |
| `materials` | Add `material_type` column (`raw` / `consumable` / `packaging`) |
| `invoices` | Update auto-number trigger to `KH-INV-YYMMDD-NNN` |
| `purchase_orders` | Update auto-number trigger to `KH-PO-YYMMDD-NNN` |

## Existing Tables — Keep As-Is
`profiles`, `customers`, `suppliers`, `stock_transactions`, `purchase_order_items`,
`quality_checks`, `tasks`, `notifications`, `invoice_items`, `payments`, `order_costings`,
`shifts`, `attendance`, `leaves`, `payroll`, `expenses`, `audit_logs`, `hsn_master`,
`chart_of_accounts`, `journal_entries`, `journal_entry_lines`

## Migrations Plan

| File | Description |
|------|-------------|
| `00001–00021` | Run all standard Just Clothing migrations first |
| `00022_kanrad_schema.sql` | Rename order prefix, seed production stages, add BOM tables, finished_goods tables, material_type column |
| `00023_kanrad_triggers.sql` | DB triggers: BOM explosion on order confirm, finished goods auto-update on batch complete, QC gate enforcement |

## Design Overrides (vs Just Clothing)
- **Primary**: Navy Blue `hsl(224 73% 38%)` — replaces Terracotta
- **Accent**: Red `hsl(0 75% 44%)` — from Kanrad logo
- **Background**: Clean white `hsl(0 0% 98%)` — replaces warm cream
- **Foreground**: Near-black `hsl(220 15% 10%)`
- **Logo**: Navy C-arc + red swoosh (see `/public/kanrad-logo.svg`)
- **Login page**: Split layout — dark navy left panel / form right (matches Kanrad brand)
- **Document prefix**: KH- (replaces JC-)

## AI (KYRE) Tool Adaptations
Rename/adapt these tools from Just Clothing:
- `list_orders` → keep, context = "work orders"
- `get_production_status` → keep, stages updated
- `check_stock` → keep + add finished goods check
- `create_order` → keep, trigger BOM explosion
- Add `get_bom` tool — retrieve BOM for a product SKU
- Add `check_bom_availability` tool — check if stock covers a BOM for given qty

## Env Vars (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL         # Kanrad Supabase project
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY=AIzaSyA1MCSgCrojzBBzOeer5v8dwYcZg6qXAbI
SARVAM_API_KEY=sk_djkrffoh_ZDWhUHvFuMlAXS1BzAlTppOj
RESEND_API_KEY
EMAIL_FROM=Kanrad ERP <notifications@kanrad.in>
OWNER_EMAIL=nihaalkarthik1@gmail.com
PORTAL_SECRET                    # 64-char hex
CRON_SECRET
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=+14155238886
OWNER_WHATSAPP                   # Owner's WhatsApp number
```

## Current Status
- [ ] `client.config.ts` created ✓
- [ ] `CLAUDE.client.md` created ✓
- [ ] Design tokens updated (globals.css primary color → navy)
- [ ] Sidebar updated (rename items, hide irrelevant)
- [ ] Migration `00022_kanrad_schema.sql` written
- [ ] Migration `00023_kanrad_triggers.sql` written
- [ ] Migrations applied in Supabase SQL Editor
- [ ] BOM module built (`/bom`)
- [ ] Work Orders page adapted
- [ ] Production stages seeded
- [ ] Finished goods inventory page
- [ ] Deploy to Vercel

## Next Steps
1. Update `globals.css` primary color to navy blue
2. Update sidebar to rename "Orders" → "Work Orders", add BOM link
3. Write and apply migrations 00022 + 00023
4. Build BOM module
5. Create Supabase project and set env vars
