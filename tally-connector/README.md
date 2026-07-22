# Kanrad ← Tally Prime connector (pull-only)

Reads data out of a desktop **TallyPrime** into cloud **Kanrad ERP**, for
viewing only. Tally has no cloud API and can't be reached from Vercel, so this
small agent runs on the **same Windows machine/LAN as Tally** and bridges the
two. Kanrad never writes anything back to Tally.

```
 Kanrad (cloud) ◀──/api/tally/inbound──── connector ◀─XML── Tally (Trial Balance)
 Kanrad (cloud) ◀──/api/tally/import────── connector ◀─XML── Tally (List of Accounts)
 Kanrad (cloud) ◀──/api/tally/outstanding── connector ◀─XML── Tally (Bills Receivable/Payable)
 Kanrad (cloud) ◀──/api/tally/vouchers───── connector ◀─XML── Tally (Voucher collection)
```

## What syncs

**Tally → Kanrad (pull only):**
- Ledger closing balances (Trial Balance) → mirrored read-only into Kanrad (`tally_ledger_balances`), with parent groups merged from List of Accounts
- Party ledgers (List of Accounts) → imported as Kanrad customers/suppliers
- Outstanding bills (Bills Receivable / Payable) → `tally_outstanding` (Finance → Outstanding)
- Vouchers (Sales / Purchase / Receipt / Payment / …) over a rolling window → `tally_vouchers` (Finance dashboard graphs). Month-chunked windowed replace, so Tally-side edits and deletions self-heal.

Nothing Kanrad does (orders, invoices, purchase orders, payments, etc.) is
ever sent to Tally. Kanrad and Tally's books are kept independently; this
connector only gives Kanrad a read-only window into Tally's numbers.

## Setup

### 1. Database (one-time)
Apply `supabase/migrations/00038_tally_sync.sql`, `00041_tally_outstanding.sql`
and `00043_tally_vouchers.sql` in the Supabase SQL editor.

### 2. Kanrad env (Vercel)
Set these environment variables and redeploy:
- `TALLY_CONNECTOR_SECRET` — a long random string (the agent's password)
- `TALLY_COMPANY` — exact Tally company name (default `KANRAD ERP`)

### 3. Tally (on the Windows machine)
- Gateway of Tally → **F1: Help → Settings → Connectivity → Client/Server config** (or F11/F1 depending on version) → set **TallyPrime acts as Server**, Port **9000**.

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
- Tally remains the source of truth for its own books; Kanrad only mirrors a
  read-only snapshot of it for dashboards and reports.
