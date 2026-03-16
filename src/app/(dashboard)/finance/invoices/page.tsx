import Link from "next/link"
import { Plus, FileText } from "lucide-react"

import { getInvoices } from "@/actions/finance"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { InvoiceActions } from "@/components/finance/invoice-actions"
import { ExportButton } from "@/components/finance/export-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  partially_paid: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  partially_paid: "Partial",
  cancelled: "Cancelled",
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

const EXPORT_COLS = [
  { key: "invoice_number", label: "Invoice #" },
  { key: "buyer_name", label: "Buyer" },
  { key: "issue_date", label: "Issue Date" },
  { key: "due_date", label: "Due Date" },
  { key: "total_amount", label: "Total (₹)" },
  { key: "amount_paid", label: "Paid (₹)" },
  { key: "outstanding", label: "Outstanding (₹)" },
  { key: "status", label: "Status" },
]

export default async function InvoicesPage() {
  const invoices = await getInvoices()

  const exportData = invoices.map((inv) => ({
    invoice_number: inv.invoice_number,
    buyer_name: inv.buyer_name,
    issue_date: inv.issue_date,
    due_date: inv.due_date ?? "",
    total_amount: inv.total_amount,
    amount_paid: inv.amount_paid,
    outstanding: inv.total_amount - inv.amount_paid,
    status: inv.status,
  }))

  return (
    <>
      <PageHeader title="Invoices" description="Generate and manage client invoices">
        <ExportButton data={exportData} columns={EXPORT_COLS} filename="invoices" />
        <Button asChild>
          <Link href="/finance/invoices/new">
            <Plus className="h-4 w-4" />
            New Invoice
          </Link>
        </Button>
      </PageHeader>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create an invoice from a completed order"
          action={{ label: "New Invoice", href: "/finance/invoices/new" }}
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr_120px_40px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Invoice</span>
            <span>Issued</span>
            <span>Due</span>
            <span>Amount</span>
            <span>Status</span>
            <span />
          </div>

          {invoices.map((inv) => {
            const outstanding = inv.total_amount - inv.amount_paid
            return (
              <Card key={inv.id} className="transition-colors hover:bg-accent/30">
                <CardContent className="grid grid-cols-[1.5fr_1fr_1fr_1fr_120px_40px] items-center gap-4 p-4">
                  <Link href={`/finance/invoices/${inv.id}`} className="min-w-0">
                    <p className="font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground truncate">{inv.buyer_name}</p>
                  </Link>
                  <p className="text-sm text-muted-foreground">{inv.issue_date}</p>
                  <p className="text-sm text-muted-foreground">{inv.due_date ?? "—"}</p>
                  <div>
                    <p className="text-sm font-medium">₹{formatCurrency(inv.total_amount)}</p>
                    {outstanding > 0 && inv.status !== "cancelled" && (
                      <p className="text-xs text-muted-foreground">
                        Due: ₹{formatCurrency(outstanding)}
                      </p>
                    )}
                  </div>
                  <Badge className={cn("w-fit text-xs font-medium", STATUS_STYLES[inv.status])}>
                    {STATUS_LABELS[inv.status] ?? inv.status}
                  </Badge>
                  <InvoiceActions invoiceId={inv.id} status={inv.status} />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
