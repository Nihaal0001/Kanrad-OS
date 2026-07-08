import Link from "next/link"
import { Wallet } from "lucide-react"

import { getPayables } from "@/actions/purchase-invoices"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate, cn } from "@/lib/utils"

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / 86400000)
}

export default async function PayablesPage() {
  const payables = await getPayables()
  const total = payables.reduce((s, p) => s + p.amount_due, 0)

  return (
    <>
      <PageHeader
        title="Payables"
        description="Money Kanrad owes suppliers — due 50 days (or the supplier's own terms) after each purchase invoice"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Payables" }]}
      />

      {payables.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Nothing owed"
          description="Payables appear here once a purchase invoice is recorded against a received PO."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">Total owed</p>
            <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          </div>

          <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_1fr_100px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Supplier</span>
            <span>PO</span>
            <span>Invoiced</span>
            <span>Due</span>
            <span>Amount Due</span>
            <span>Status</span>
          </div>

          {payables.map((p) => {
            const overdueDays = daysUntil(p.due_date)
            const isOverdue = overdueDays != null && overdueDays < 0
            return (
              <Card key={p.id} className={cn("transition-colors hover:bg-accent/30", isOverdue && "border-destructive/40")}>
                <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_100px] sm:items-center sm:gap-4">
                  <Link href={`/finance/purchases/${p.id}`} className="min-w-0">
                    <p className="text-sm font-medium">{p.supplier_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.invoice_number ?? "No supplier bill #"}</p>
                  </Link>
                  <p className="font-mono text-sm text-muted-foreground">{p.po_number ?? "--"}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(p.invoice_date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.due_date ? formatDate(p.due_date) : "--"}
                    {isOverdue && <span className="ml-1 text-xs font-medium text-destructive">({Math.abs(overdueDays!)}d overdue)</span>}
                  </p>
                  <p className="text-sm font-semibold">{formatCurrency(p.amount_due)}</p>
                  <Badge variant={isOverdue ? "destructive" : "secondary"} className="w-fit text-xs">
                    {isOverdue ? "Overdue" : p.status === "partially_paid" ? "Partially Paid" : "Received"}
                  </Badge>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
