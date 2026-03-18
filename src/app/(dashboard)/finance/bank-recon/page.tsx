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
    .select("id, amount, payment_date, method, reference, invoice:invoices(invoice_number, buyer_name)")
    .gte("payment_date", since.toISOString().slice(0, 10))
    .order("payment_date", { ascending: false })

  const { data: purchasePayments } = await supabase
    .from("purchase_payments")
    .select("id, amount, payment_date, method, reference")
    .gte("payment_date", since.toISOString().slice(0, 10))
    .order("payment_date", { ascending: false })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allPayments = [
    ...((payments ?? []).map((p: any) => ({
      id: p.id,
      amount: p.amount,
      date: p.payment_date,
      method: p.method,
      reference: p.reference,
      label: `${p.invoice?.invoice_number ?? "—"} · ${p.invoice?.buyer_name ?? "—"}`,
      type: "sales" as const,
    }))),
    ...((purchasePayments ?? []).map((p: any) => ({
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
