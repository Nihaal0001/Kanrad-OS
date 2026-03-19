import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"

import { getInvoice, updateInvoiceStatus } from "@/actions/finance"
import { getCreditNotes } from "@/actions/credit-notes"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { PaymentForm } from "@/components/finance/payment-form"
import { PrintButton } from "@/components/finance/print-button"
import { InvoiceActions } from "@/components/finance/invoice-actions"
import { EInvoiceButton } from "@/components/finance/einvoice-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
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
  partially_paid: "Partially Paid",
  cancelled: "Cancelled",
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function InvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("auth_id", user.id).maybeSingle()
    : { data: null }
  const canDeletePaid = profile?.role === "admin"

  let invoice
  try {
    invoice = await getInvoice(id)
  } catch {
    notFound()
  }

  const outstanding = invoice.total_amount - invoice.amount_paid
  const creditNotes = await getCreditNotes({ invoice_id: id }).catch(() => [])

  async function markSent() {
    "use server"
    await updateInvoiceStatus(id, "sent")
  }

  async function cancelInvoice() {
    "use server"
    await updateInvoiceStatus(id, "cancelled")
  }

  return (
    <>
      <PageHeader
        title={invoice.invoice_number}
        description={`Issued to ${invoice.buyer_name}`}
        breadcrumbs={[
          { label: "Finance", href: "/finance/invoices" },
          { label: "Invoices", href: "/finance/invoices" },
          { label: invoice.invoice_number },
        ]}
      >
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs font-medium", STATUS_STYLES[invoice.status])}>
            {STATUS_LABELS[invoice.status] ?? invoice.status}
          </Badge>

          {invoice.status === "draft" && (
            <form action={markSent}>
              <Button type="submit" size="sm" variant="outline">
                Mark as Sent
              </Button>
            </form>
          )}

          {(invoice.status === "sent" || invoice.status === "partially_paid") && outstanding > 0 && (
            <PaymentForm
              invoiceId={id}
              invoiceNumber={invoice.invoice_number}
              outstanding={outstanding}
            />
          )}

          {invoice.status !== "cancelled" && invoice.status !== "paid" && (
            <form action={cancelInvoice}>
              <Button
                type="submit"
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive"
              >
                Cancel Invoice
              </Button>
            </form>
          )}

          <EInvoiceButton invoiceId={id} invoiceNumber={invoice.invoice_number} status={invoice.status} />
          <InvoiceActions invoiceId={id} status={invoice.status} redirectAfterDelete canDeletePaid={canDeletePaid} />
        </div>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild className="mb-6 -mt-4">
        <Link href="/finance/invoices">
          <ArrowLeft className="h-4 w-4" />
          Back to Invoices
        </Link>
      </Button>

      {/* Print-ready invoice */}
      <Card className="mb-6 print:shadow-none print:border-0">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight text-primary">INVOICE</h2>
              <p className="text-muted-foreground mt-1">{invoice.invoice_number}</p>
            </div>
            <div className="text-right text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Issue Date:</span> {invoice.issue_date}
              </p>
              {invoice.due_date && (
                <p>
                  <span className="text-muted-foreground">Due Date:</span> {invoice.due_date}
                </p>
              )}
              {invoice.order && (
                <p>
                  <span className="text-muted-foreground">Order:</span>{" "}
                  <Link href={`/orders/${invoice.order.id}`} className="text-primary hover:underline">
                    {invoice.order.order_number}
                  </Link>
                </p>
              )}
            </div>
          </div>

          {/* Bill To */}
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Bill To
            </p>
            <p className="font-semibold">{invoice.buyer_name}</p>
            {invoice.buyer_address && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {invoice.buyer_address}
              </p>
            )}
            {invoice.buyer_gst && (
              <p className="text-sm text-muted-foreground">GST: {invoice.buyer_gst}</p>
            )}
          </div>

          {/* Items table */}
          <div>
            <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b border-border">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-border/50">
              {invoice.invoice_items.map((item: { id: string; description: string; quantity: number; unit_price: number; amount: number }) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_80px_120px_120px] gap-3 py-3 text-sm"
                >
                  <span>{item.description}</span>
                  <span className="text-right text-muted-foreground">{item.quantity}</span>
                  <span className="text-right text-muted-foreground">
                    ₹{formatCurrency(item.unit_price)}
                  </span>
                  <span className="text-right font-medium">₹{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{formatCurrency(invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                <span>₹{formatCurrency(invoice.tax_amount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base">
                <span>Total</span>
                <span>₹{formatCurrency(invoice.total_amount)}</span>
              </div>
              {invoice.amount_paid > 0 && (
                <>
                  <div className="flex justify-between text-emerald-600">
                    <span>Paid</span>
                    <span>₹{formatCurrency(invoice.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Outstanding</span>
                    <span
                      className={outstanding > 0 ? "text-destructive" : "text-emerald-600"}
                    >
                      ₹{formatCurrency(outstanding)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="border-t border-border pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Notes / Terms
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end mb-6 print:hidden">
        <PrintButton invoiceId={id} />
      </div>

      {/* Credit Notes */}
      {(creditNotes.length > 0 || invoice.status !== "cancelled") && (
        <Card className="print:hidden">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Credit Notes</CardTitle>
            <Link href={`/finance/credit-notes/new?invoice_id=${id}`}>
              <Button size="sm" variant="outline">
                <Plus className="mr-1 h-3.5 w-3.5" />
                New Credit Note
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {creditNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No credit notes for this invoice.</p>
            ) : (
              <div className="space-y-2">
                {creditNotes.map((cn) => (
                  <Link key={cn.id} href={`/finance/credit-notes/${cn.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors">
                    <div>
                      <p className="text-sm font-mono font-medium">{cn.credit_note_number}</p>
                      {cn.reason && <p className="text-xs text-muted-foreground truncate max-w-xs">{cn.reason}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[hsl(16,65%,55%)]">₹{cn.total_amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      <Badge className={cn.status === "issued" ? "bg-blue-100 text-blue-700" : "bg-muted text-muted-foreground"}>
                        {cn.status}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  )
}
