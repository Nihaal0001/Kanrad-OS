import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { getPurchaseInvoice, updatePurchaseInvoiceStatus } from "@/actions/purchase-invoices"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { PurchasePaymentForm } from "@/components/finance/purchase-payment-form"
import { PurchaseInvoiceActions } from "@/components/finance/purchase-invoice-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
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

interface Props {
  params: Promise<{ id: string }>
}

export default async function PurchaseInvoiceDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = user
    ? await supabase.from("profiles").select("role").eq("auth_id", user.id).maybeSingle()
    : { data: null }
  const canDeletePaid = profile?.role === "admin"

  let invoice
  try {
    invoice = await getPurchaseInvoice(id)
  } catch {
    notFound()
  }

  const outstanding = Math.max(0, (invoice.total_amount ?? 0) - (invoice.amount_paid ?? 0))

  async function markReceived() {
    "use server"
    await updatePurchaseInvoiceStatus(id, "received")
  }

  async function cancelInvoice() {
    "use server"
    await updatePurchaseInvoiceStatus(id, "cancelled")
  }

  return (
    <>
      <PageHeader
        title={invoice.invoice_number || "Purchase Invoice"}
        description={`From ${invoice.supplier_name}`}
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Purchases", href: "/finance/purchases" },
          { label: invoice.invoice_number || "Detail" },
        ]}
      >
        <div className="flex items-center gap-2">
          <Badge className={cn("text-xs font-medium", STATUS_STYLES[invoice.status])}>
            {STATUS_LABELS[invoice.status] ?? invoice.status}
          </Badge>

          {invoice.status === "draft" && (
            <form action={markReceived}>
              <Button type="submit" size="sm" variant="outline">
                Mark as Received
              </Button>
            </form>
          )}

          {(invoice.status === "received" || invoice.status === "partially_paid") && outstanding > 0 && (
            <PurchasePaymentForm
              purchaseInvoiceId={id}
              invoiceNumber={invoice.invoice_number || ""}
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
                Cancel
              </Button>
            </form>
          )}

          <PurchaseInvoiceActions
            invoiceId={id}
            status={invoice.status}
            redirectAfterDelete
            canDeletePaid={canDeletePaid}
          />
        </div>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild className="mb-6 -mt-4">
        <Link href="/finance/purchases">
          <ArrowLeft className="h-4 w-4" />
          Back to Purchases
        </Link>
      </Button>

      {/* Invoice Details */}
      <Card className="mb-6">
        <CardContent className="p-8 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">PURCHASE INVOICE</h2>
              {invoice.invoice_number && (
                <p className="text-muted-foreground mt-1">#{invoice.invoice_number}</p>
              )}
            </div>
            <div className="text-right text-sm space-y-1">
              <p>
                <span className="text-muted-foreground">Date:</span> {invoice.invoice_date}
              </p>
              {invoice.due_date && (
                <p>
                  <span className="text-muted-foreground">Due:</span> {invoice.due_date}
                </p>
              )}
              {invoice.place_of_supply && (
                <p>
                  <span className="text-muted-foreground">Place of Supply:</span> {invoice.place_of_supply}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              Supplier
            </p>
            <p className="font-semibold">{invoice.supplier_name}</p>
            {invoice.supplier_gst && (
              <p className="text-sm text-muted-foreground">GST: {invoice.supplier_gst}</p>
            )}
          </div>

          {/* Items */}
          <div>
            <div className="grid grid-cols-[1fr_80px_120px_120px] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b">
              <span>Description</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Unit Price</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-border/50">
              {invoice.purchase_invoice_items.map((item: {
                id: string; description: string; quantity: number; unit_price: number; amount: number; hsn_code?: string
              }) => (
                <div
                  key={item.id}
                  className="grid grid-cols-[1fr_80px_120px_120px] gap-3 py-3 text-sm"
                >
                  <div>
                    <span>{item.description}</span>
                    {item.hsn_code && (
                      <span className="ml-2 text-xs text-muted-foreground">HSN: {item.hsn_code}</span>
                    )}
                  </div>
                  <span className="text-right text-muted-foreground">{item.quantity}</span>
                  <span className="text-right text-muted-foreground">₹{formatCurrency(item.unit_price)}</span>
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
              {invoice.is_igst ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IGST ({invoice.tax_rate}%)</span>
                  <span>₹{formatCurrency(invoice.igst_amount)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CGST ({invoice.tax_rate / 2}%)</span>
                    <span>₹{formatCurrency(invoice.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">SGST ({invoice.tax_rate / 2}%)</span>
                    <span>₹{formatCurrency(invoice.sgst_amount)}</span>
                  </div>
                </>
              )}
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
                    <span className={outstanding > 0 ? "text-destructive" : "text-emerald-600"}>
                      ₹{formatCurrency(outstanding)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {invoice.notes && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PO Comparison Card */}
      {invoice.linked_po && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">
              Linked Purchase Order — {invoice.linked_po.po_number}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2 border-b">
              <span>Item</span>
              <span className="text-right">Ordered Qty</span>
              <span className="text-right">Ordered Price</span>
              <span className="text-right">Invoiced Qty</span>
              <span className="text-right">Invoiced Price</span>
            </div>
            <div className="divide-y divide-border/50">
              {(invoice.linked_po.purchase_order_items ?? []).map((poi: {
                id: string; material_name: string; quantity: number; unit_price: number
              }) => {
                // Match to invoice item by description (best-effort)
                const matchedItem = invoice.purchase_invoice_items.find((ii: { description: string }) =>
                  ii.description.toLowerCase().includes(poi.material_name?.toLowerCase() ?? "")
                )
                const qtyMatch = matchedItem ? matchedItem.quantity === poi.quantity : null
                const priceMatch = matchedItem ? matchedItem.unit_price === poi.unit_price : null
                return (
                  <div key={poi.id} className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-3 py-3 text-sm">
                    <span className="font-medium">{poi.material_name}</span>
                    <span className="text-right text-muted-foreground">{poi.quantity}</span>
                    <span className="text-right text-muted-foreground">₹{formatCurrency(poi.unit_price)}</span>
                    <span className={`text-right font-medium ${matchedItem && !qtyMatch ? "text-amber-600" : ""}`}>
                      {matchedItem ? matchedItem.quantity : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span className={`text-right font-medium ${matchedItem && !priceMatch ? "text-amber-600" : ""}`}>
                      {matchedItem ? `₹${formatCurrency(matchedItem.unit_price)}` : <span className="text-muted-foreground">—</span>}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t flex gap-6 text-xs text-muted-foreground">
              <span>PO Total: <strong>₹{formatCurrency(invoice.linked_po.total_amount ?? 0)}</strong></span>
              <span>Invoice Total: <strong>₹{formatCurrency(invoice.total_amount ?? 0)}</strong></span>
              {Math.abs((invoice.linked_po.total_amount ?? 0) - (invoice.total_amount ?? 0)) > 0.01 && (
                <span className="text-amber-600 font-medium">
                  Δ ₹{formatCurrency(Math.abs((invoice.linked_po.total_amount ?? 0) - (invoice.total_amount ?? 0)))} variance
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment History */}
      {invoice.purchase_payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {invoice.purchase_payments.map((p: {
                id: string; amount: number; method: string; payment_date: string; reference?: string
              }) => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <div>
                    <p className="font-medium">₹{formatCurrency(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {METHOD_LABELS[p.method] ?? p.method} · {p.payment_date}
                      {p.reference && ` · ${p.reference}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
