import Link from "next/link"
import { Plus, FileInput, Sparkles } from "lucide-react"

import { getPurchaseInvoices } from "@/actions/purchase-invoices"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { PurchaseInvoiceActions } from "@/components/finance/purchase-invoice-actions"
import { PurchaseInvoiceExportButton } from "@/components/finance/purchase-invoice-export-button"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  received: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  partially_paid: "bg-amber-100 text-amber-700",
  overdue: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  received: "Received",
  paid: "Paid",
  partially_paid: "Partially Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

export default async function PurchaseInvoicesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("auth_id", user.id).maybeSingle()
    : { data: null }
  const canDeletePaid = profile?.role === "admin"

  const invoices = await getPurchaseInvoices()

  const totalAmount = invoices.reduce((sum, i) => sum + (i.total_amount ?? 0), 0)
  const totalOutstanding = invoices.reduce(
    (sum, i) => sum + Math.max(0, (i.total_amount ?? 0) - (i.amount_paid ?? 0)),
    0
  )

  return (
    <>
      <PageHeader
        title="Purchase Invoices"
        description={
          invoices.length > 0
            ? `${invoices.length} invoices · ₹${formatCurrency(totalAmount)} total · ₹${formatCurrency(totalOutstanding)} outstanding`
            : "Track supplier bills and payments"
        }
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Purchases" },
        ]}
      >
        <Link href="/finance/import?target=purchase_invoice">
          <Button variant="outline">
            <Sparkles className="h-4 w-4" />
            Upload Invoice
          </Button>
        </Link>
        <PurchaseInvoiceExportButton />
        <Link href="/finance/purchases/new">
          <Button>
            <Plus className="h-4 w-4" />
            New Purchase Invoice
          </Button>
        </Link>
      </PageHeader>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileInput}
          title="No purchase invoices"
          description="Record supplier bills to track payables and input GST"
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
            <span>Invoice #</span>
            <span>Supplier</span>
            <span>Date</span>
            <span>Total</span>
            <span>Outstanding</span>
            <span>Status</span>
            <span />
          </div>

          {invoices.map((inv) => {
            const outstanding = Math.max(0, (inv.total_amount ?? 0) - (inv.amount_paid ?? 0))
            return (
              <Link key={inv.id} href={`/finance/purchases/${inv.id}`}>
                <Card className="hover:bg-muted/30 transition-colors cursor-pointer">
                  <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1fr_1.5fr_1fr_1fr_1fr_1fr_40px] sm:items-center sm:gap-4">
                    <p className="text-sm font-medium">
                      {inv.invoice_number || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {inv.supplier_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{inv.invoice_date}</p>
                    <p className="text-sm font-medium">₹{formatCurrency(inv.total_amount ?? 0)}</p>
                    <p className={`text-sm font-medium ${outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      ₹{formatCurrency(outstanding)}
                    </p>
                    <Badge className={`w-fit text-xs ${STATUS_COLORS[inv.status] ?? ""}`}>
                      {STATUS_LABELS[inv.status] ?? inv.status}
                    </Badge>
                    <PurchaseInvoiceActions invoiceId={inv.id} status={inv.status} canDeletePaid={canDeletePaid} />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
