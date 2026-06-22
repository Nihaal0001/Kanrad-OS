# Kanrad ↔ Tally Prime connector

Two-way sync between cloud **Kanrad ERP** and a desktop **TallyPrime**. Tally has
no cloud API and can't be reached from Vercel, so this small agent runs on the
**same Windows machine/LAN as Tally** and bridges the two.

```
 Kanrad (cloud) ──/api/tally/outbox──▶ connector ──XML──▶ Tally (localhost:9000)
 Kanrad (cloud) ◀──/api/tally/inbound── connector ◀─XML── Tally (Trial Balance)
```

## What syncs

**Kanrad → Tally (push):**
- Masters: customers → *Sundry Debtors* ledgers, suppliers → *Sundry Creditors*, finished goods → stock items
- Vouchers: sales invoices → Sales, purchase invoices → Purchase, customer payments → Receipt, supplier payments → Payment

**Tally → Kanrad (pull):**
- Ledger closing balances (Trial Balance) → mirrored read-only into Kanrad (`tally_ledger_balances`)

Masters are re-pushed when they change; vouchers are pushed once (create-once)
to avoid duplicates. Each item is acked individually, so a failure on one (e.g.
a missing tax ledger) doesn't block the rest.

## Setup

### 1. Database (one-time)
Apply `supabase/migrations/00038_tally_sync.sql` in the Supabase SQL editor.

### 2. Kanrad env (Vercel)
Set these environment variables and redeploy:
- `TALLY_CONNECTOR_SECRET` — a long random string (the agent's password)
- `TALLY_COMPANY` — exact Tally company name (default `KANRAD ERP`)
- `TALLY_BANK_LEDGER` — cash/bank ledger receipts & payments post to (default `Bank`)

### 3. Tally (on the Windows machine)
- Gateway of Tally → **F1: Help → Settings → Connectivity → Client/Server config** (or F11/F1 depending on version) → set **TallyPrime acts as Server**, Port **9000**.
- Create the GST tax ledgers you use (e.g. `Output CGST @9%`, `Output SGST @9%`, `Output IGST @18%`, and the `Input ...` equivalents), plus `Sales`, `Purchases`, and the bank ledger. Party ledgers and stock items are created automatically by the push.

### 4. Run the connector
```bash
cd tally-connector
cp .env.example .env      # then edit .env
npm start
```
Leave it running (or install as a Windows service via `nssm`, PM2, or Task Scheduler).

## Notes / limits
- Cannot be tested without a live Tally on `localhost:9000`; first run against a
  **test Tally company** and check the import counts in the logs.
- Tally's Trial Balance XML shape varies slightly by version — if `pull: no
  balances parsed`, share a sample export and the parser can be adjusted.
- This is the recommended ownership split: Kanrad is the source of truth for
  masters + transactions; Tally owns final balances (pulled back read-only).
