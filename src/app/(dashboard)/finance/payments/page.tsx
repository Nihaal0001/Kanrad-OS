import Link from "next/link"
import { CreditCard } from "lucide-react"

import { getPayments } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PaymentActions } from "@/components/finance/payment-actions"
import { ExportButton } from "@/components/finance/export-button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  upi: "UPI",
  other: "Other",
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

const EXPORT_COLS = [
  { key: "payment_date", label: "Date" },
  { key: "invoice_number", label: "Invoice #" },
  { key: "buyer_name", label: "Buyer" },
  { key: "amount", label: "Amount (₹)" },
  { key: "method", label: "Method" },
  { key: "reference", label: "Reference" },
]

export default async function PaymentsPage() {
  const payments = await getPayments()

  const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0)

  const exportData = payments.map((p) => ({
    payment_date: p.payment_date,
    invoice_number: p.invoice?.invoice_number ?? "",
    buyer_name: p.invoice?.buyer_name ?? "",
    amount: p.amount,
    method: METHOD_LABELS[p.method] ?? p.method,
    reference: p.reference ?? "",
  }))

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          payments.length > 0
            ? `${payments.length} payments · ₹${formatCurrency(totalReceived)} total received`
            : "Track payments received"
        }
      >
        <ExportButton data={exportData} columns={EXPORT_COLS} filename="payments" />
      </PageHeader>

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payments recorded"
          description="Payments appear here once recorded against an invoice"
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Invoice</span>
            <span>Buyer</span>
            <span>Date</span>
            <span>Method</span>
            <span>Amount</span>
            <span />
          </div>

          {payments.map((p) => (
            <Card key={p.id}>
              <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_40px] items-center gap-4 p-4">
                <div>
                  {p.invoice ? (
                    <Link
                      href={`/finance/invoices/${p.invoice.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {p.invoice.invoice_number}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  {p.reference && (
                    <p className="text-xs text-muted-foreground">{p.reference}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {p.invoice?.buyer_name ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground">{p.payment_date}</p>
                <Badge variant="outline" className="w-fit text-xs">
                  {METHOD_LABELS[p.method] ?? p.method}
                </Badge>
                <p className="text-sm font-semibold text-emerald-600">
                  +₹{formatCurrency(p.amount)}
                </p>
                <PaymentActions paymentId={p.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
