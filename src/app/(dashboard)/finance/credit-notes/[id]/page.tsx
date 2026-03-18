import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getCreditNote, updateCreditNoteStatus, deleteCreditNote } from "@/actions/credit-notes"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-600",
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2 })
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function CreditNoteDetailPage({ params }: Props) {
  const { id } = await params

  let cn
  try {
    cn = await getCreditNote(id)
  } catch {
    notFound()
  }

  async function issue() {
    "use server"
    await updateCreditNoteStatus(id, "issued")
  }

  async function cancel() {
    "use server"
    await updateCreditNoteStatus(id, "cancelled")
  }

  async function remove() {
    "use server"
    await deleteCreditNote(id)
  }

  return (
    <>
      <PageHeader
        title={cn.credit_note_number || "Credit Note"}
        description={`Buyer: ${cn.buyer_name}`}
        breadcrumbs={[
          { label: "Finance", href: "/finance" },
          { label: "Credit Notes", href: "/finance/credit-notes" },
          { label: cn.credit_note_number || "Detail" },
        ]}
      >
        <div className="flex items-center gap-2">
          <Badge className={cn(STATUS_STYLES[cn.status ?? "draft"], "text-xs font-medium")}>
            {cn.status}
          </Badge>
          {cn.status === "draft" && (
            <form action={issue}>
              <Button type="submit" size="sm" variant="outline">Issue</Button>
            </form>
          )}
          {cn.status !== "cancelled" && (
            <form action={cancel}>
              <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                Cancel
              </Button>
            </form>
          )}
          {cn.status === "draft" && (
            <form action={remove}>
              <Button type="submit" size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                Delete
              </Button>
            </form>
          )}
        </div>
      </PageHeader>

      <Button variant="ghost" size="sm" asChild className="mb-6 -mt-4">
        <Link href="/finance/credit-notes">
          <ArrowLeft className="h-4 w-4" />
          Back to Credit Notes
        </Link>
      </Button>

      <Card className="max-w-3xl">
        <CardContent className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[hsl(16,65%,55%)]">CREDIT NOTE</h2>
              <p className="text-muted-foreground mt-1">{cn.credit_note_number}</p>
            </div>
            <div className="text-right text-sm space-y-1 text-muted-foreground">
              <p>Date: <span className="text-foreground">{cn.issue_date}</span></p>
              {cn.invoice_id && <p>Invoice Ref: <Link href={`/finance/invoices/${cn.invoice_id}`} className="text-primary hover:underline">View Invoice</Link></p>}
            </div>
          </div>

          {/* Buyer */}
          <div className="rounded-lg bg-secondary/50 p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Credit To</p>
            <p className="font-semibold">{cn.buyer_name}</p>
            {cn.buyer_gst && <p className="text-sm text-muted-foreground">GST: {cn.buyer_gst}</p>}
            {cn.reason && <p className="text-sm text-muted-foreground mt-1">Reason: {cn.reason}</p>}
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
              {(cn.credit_note_items ?? []).map((item: {
                id: string; description: string; quantity: number; unit_price: number; amount: number
              }) => (
                <div key={item.id} className="grid grid-cols-[1fr_80px_120px_120px] gap-3 py-3 text-sm">
                  <span>{item.description}</span>
                  <span className="text-right text-muted-foreground">{item.quantity}</span>
                  <span className="text-right text-muted-foreground">₹{fmt(item.unit_price)}</span>
                  <span className="text-right font-medium">₹{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-60 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>₹{fmt(cn.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({cn.tax_rate}%)</span>
                <span>₹{fmt(cn.tax_amount)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold text-base text-[hsl(16,65%,55%)]">
                <span>Credit Total</span>
                <span>₹{fmt(cn.total_amount)}</span>
              </div>
            </div>
          </div>

          {cn.notes && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{cn.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
