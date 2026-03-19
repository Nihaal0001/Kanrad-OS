import { BankReconClient } from "./bank-recon-client"
import { PageHeader } from "@/components/shared/page-header"
import { createClient } from "@/lib/supabase/server"

export default async function BankReconPage() {
  const supabase = await createClient()

  // Fetch recent payments (last 90 days)
  const since = new Date()
  since.setDate(since.getDate() - 90)

  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, payment_date, method, reference, invoice:invoices(invoice_number, customer_name)")
    .gte("payment_date", since.toISOString().slice(0, 10))
    .order("payment_date", { ascending: false })

  const { data: purchasePayments } = await supabase
    .from("purchase_payments")
    .select("id, amount, payment_date, method, reference")
    .gte("payment_date", since.toISOString().slice(0, 10))
    .order("payment_date", { ascending: false })

  const allPayments = [
    ...((payments ?? []).map((p: SalesPayment) => {
      const invoice = Array.isArray(p.invoice) ? p.invoice[0] ?? null : p.invoice
      return {
      id: p.id,
      amount: p.amount,
      date: p.payment_date,
      method: p.method,
      reference: p.reference,
      label: `${invoice?.invoice_number ?? "—"} · ${invoice?.customer_name ?? "—"}`,
      type: "sales" as const,
      }
    })),
    ...((purchasePayments ?? []).map((p: PurchasePayment) => ({
      id: p.id,
      amount: p.amount,
      date: p.payment_date,
      method: p.method,
      reference: p.reference,
      label: `Purchase Payment`,
      type: "purchase" as const,
    }))),
  ].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <>
      <PageHeader
        title="Bank Reconciliation"
        description="Import your bank statement CSV and match with recorded payments"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Reconciliation" }]}
      />
      <BankReconClient payments={allPayments} />
    </>
  )
}
  type SalesPayment = {
    id: string
    amount: number
    payment_date: string
    method: string
    reference: string | null
    invoice:
      | { invoice_number: string; customer_name: string | null }
      | { invoice_number: string; customer_name: string | null }[]
      | null
  }

  type PurchasePayment = {
    id: string
    amount: number
    payment_date: string
    method: string
    reference: string | null
  }
