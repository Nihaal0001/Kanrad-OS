import Link from "next/link"
import { Wallet2 } from "lucide-react"

import { getReceivables } from "@/actions/finance"
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

export default async function ReceivablesPage() {
  const receivables = await getReceivables()
  const total = receivables.reduce((s, r) => s + r.amount_due, 0)

  return (
    <>
      <PageHeader
        title="Receivables"
        description="Money customers owe Kanrad — outstanding invoices from shipped orders"
        breadcrumbs={[{ label: "Finance", href: "/finance" }, { label: "Receivables" }]}
      />

      {receivables.length === 0 ? (
        <EmptyState
          icon={Wallet2}
          title="Nothing outstanding"
          description="Receivables appear here once an order is shipped and invoiced."
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <p className="text-sm text-muted-foreground">Total outstanding</p>
            <p className="text-2xl font-bold">{formatCurrency(total)}</p>
          </div>

          <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_1fr_100px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Invoice</span>
            <span>Bill No.</span>
            <span>Issued</span>
            <span>Due</span>
            <span>Amount Due</span>
            <span>Status</span>
          </div>

          {receivables.map((r) => {
            const overdueDays = daysUntil(r.due_date)
            const isOverdue = overdueDays != null && overdueDays < 0
            return (
              <Card key={r.id} className={cn("transition-colors hover:bg-accent/30", isOverdue && "border-destructive/40")}>
                <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_100px] sm:items-center sm:gap-4">
                  <Link href={`/finance/invoices/${r.id}`} className="min-w-0">
                    <p className="text-sm font-medium">{r.invoice_number}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.customer_name}</p>
                  </Link>
                  <p className="font-mono text-sm text-muted-foreground">{r.bill_no ?? "--"}</p>
                  <p className="text-sm text-muted-foreground">{formatDate(r.issue_date)}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.due_date ? formatDate(r.due_date) : "--"}
                    {isOverdue && <span className="ml-1 text-xs font-medium text-destructive">({Math.abs(overdueDays!)}d overdue)</span>}
                  </p>
                  <p className="text-sm font-semibold">{formatCurrency(r.amount_due)}</p>
                  <Badge variant={isOverdue ? "destructive" : "secondary"} className="w-fit text-xs">
                    {isOverdue ? "Overdue" : r.status === "partially_paid" ? "Partially Paid" : "Sent"}
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
