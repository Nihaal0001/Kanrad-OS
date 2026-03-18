# Feature Roadmap — Multi-Industry Manufacturing ERP

## Overview

"Just Clothing" serves as the demo/template for garment manufacturing. The ERP is designed to be adapted for multiple industries (food, furniture, leather, pharma, electronics, etc.) via git branches per client.

This roadmap covers 20 features across 6 phases, prioritized from table-stakes to differentiators.

All pending migrations (00007, 00010, 00013) have been run.

---

## Phase 1: Trust & Compliance ✅ COMPLETE

| # | Feature | Details |
|---|---------|---------|
| 1 | **Audit trail** | `audit_logs` table (who, what, when, old_value, new_value). Hook into server actions for orders, invoices, production, inventory, HR. Dashboard activity feed pulls from this. |
| 2 | **HSN/SAC codes** | Add `hsn_code` column to `order_items` + `materials`. Display on invoices (GST compliance). |
| 3 | **Full data export** | Settings page → "Export All Data" → ZIP of all tables as Excel files. |
| 4 | **Journal & ledger entries** | Double-entry accounting: `journal_entries` + `ledger` tables. Every financial transaction auto-creates journal entries. Ledger view with debits/credits. Chart of accounts (configurable). Trial balance report. |

## Phase 2: Daily Operations ✅ COMPLETE

| # | Feature | Details |
|---|---------|---------|
| 5 | **Customers & Suppliers directory** | `customers` and `suppliers` tables with: name, company, GSTIN, address, phone, email, bank details, notes. Auto-link to orders/invoices and POs/purchase invoices. Auto-suggest on forms. Replaces current `buyers` table. |
| 6 | **Delivery challan** | PDF generation from dispatched orders: challan #, transporter, LR #, vehicle #, item list. |
| 7 | **Packing slip** | Simpler PDF: order #, buyer, item list with quantities, packed by, date. |
| 8 | **Order dispatch details** | New fields on orders: transporter name, LR #, vehicle #, dispatch date, expected delivery date. |
| 9 | **Copy/repeat order** | "Duplicate" button on order detail → pre-fills new order form with same buyer, items, breakdown. |

## Phase 3: Smarter Inventory & Costing ✅ COMPLETE

| # | Feature | Details |
|---|---------|---------|
| 10 | **Wastage/scrap tracking** | Per production stage: input qty vs output qty. Auto-calculate waste %. Alert if waste > threshold. |
| 11 | **PO ↔ Purchase invoice matching** | Link purchase invoices to POs. Highlight quantity/price mismatches (3-way matching). |
| 12 | **Enhanced order costing** | Auto-pull material cost + labor + overhead → per-order profit margin on order detail page. |

## Phase 4: Notifications & Communication ✅ COMPLETE

| # | Feature | Details |
|---|---------|---------|
| 13 | **Email notifications** | Low stock, overdue invoices, leave requests, order status changes → email to relevant person. |
| 14 | **WhatsApp integration** | Owner daily digest + critical alerts via WhatsApp Business API. |
| 15 | **Worker payslip delivery** | Monthly payslip auto-sent to worker via WhatsApp/email after payroll processed. |

## Phase 5: Demo Polish

| # | Feature | Details |
|---|---------|---------|
| 16 | **Buyer portal** | Token-based read-only page: order status, production progress, expected delivery. Shareable link, no login needed. |

## Phase 6: Financial Maturity

| # | Feature | Details |
|---|---------|---------|
| 17 | **Credit notes / returns** | Return workflow: buyer rejects X pieces → credit note → adjusts receivables. Auto-creates journal entry. |
| 18 | **Tally XML export** | Export sales + purchase data as Tally-compatible XML for CAs. |
| 19 | **E-invoice (GST portal)** | Generate IRN via GST portal API, QR code on invoice (required above ₹5Cr turnover). |
| 20 | **Bank reconciliation** | Import bank statement CSV → match with recorded payments → flag unmatched transactions. |

---

## Multi-Client Delivery Strategy

- **One repo**, client branches off `main`: `client/company-name`
- Each client: own Supabase project + Vercel deployment
- Branding: replace "JUST CLOTHING" (~15 files) + swap CSS color palette
- Production stages: adjust per industry
- Bug fixes on `main` → merge to client branches
- At 10+ clients: extract to `client.config.ts` for zero-code branding

### New Client Onboarding (~half day)
1. `git checkout -b client/name main`
2. New Supabase project → update `.env.local`
3. Run all migrations
4. Replace branding + colors
5. Adjust modules/stages for their industry
6. Deploy to Vercel, point domain

### Cost Per Client
| Service | Cost |
|---------|------|
| Supabase (free tier) | $0 (first 2), then $25/mo |
| Vercel (free tier) | $0 |
| Gemini AI (free tier) | $0 |
| Custom domain | ~$12/year |

---

## Competitive Advantages

1. **Vertical-first** — purpose-built production pipeline, not a generic ERP configured by a consultant
2. **AI-native (KYRE)** — voice + chat agent with 12+ integrated tools (attendance, production, leaves, tasks)
3. **Owner-centric finance** — P&L, cash flow, GST summary in one click, no accounting degree needed
4. **Factory-floor UX** — QR kiosk attendance, mobile-first, command palette, click-to-mark
5. **10-minute setup** — deploy on Vercel + run migrations, not a 6-month SAP implementation
