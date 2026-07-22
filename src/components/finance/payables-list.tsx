"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2 } from "lucide-react"

import { createPurchasePayment } from "@/actions/purchase-invoices"
import { formatCurrency, formatDate, friendlyError, cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface Payable {
  id: string
  supplier_name: string
  invoice_number: string | null
  po_number: string | null
  invoice_date: string
  due_date: string | null
  amount_due: number
  status: string
  received_bill_nos: string[]
}

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
] as const

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(diff / 86400000)
}

export function PayablesList({
  payables: initialPayables,
  defaultTallyLedger,
}: {
  payables: Payable[]
  defaultTallyLedger: string
}) {
  const router = useRouter()
  const [payables, setPayables] = useState(initialPayables)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [method, setMethod] = useState<string>("bank_transfer")
  const [reference, setReference] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [tallyLedger, setTallyLedger] = useState(defaultTallyLedger)
  const [submitting, setSubmitting] = useState(false)

  const total = payables.reduce((s, p) => s + p.amount_due, 0)
  const payingRow = payables.find((p) => p.id === payingId) ?? null

  function openPayDialog(id: string) {
    setPayingId(id)
    setMethod("bank_transfer")
    setReference("")
    setPaymentDate(new Date().toISOString().slice(0, 10))
    setTallyLedger(defaultTallyLedger)
  }

  async function handleConfirmPayment() {
    if (!payingRow) return
    if (!tallyLedger.trim()) {
      toast.error("Enter the Tally ledger this payment should post against")
      return
    }
    setSubmitting(true)
    const result = await createPurchasePayment({
      purchase_invoice_id: payingRow.id,
      amount: payingRow.amount_due,
      method: method as "cash" | "bank_transfer" | "cheque" | "upi" | "other",
      reference,
      payment_date: paymentDate,
      notes: "",
      tally_ledger: tallyLedger.trim(),
    })
    setSubmitting(false)

    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }

    toast.success(`Marked ${payingRow.supplier_name} as paid`)
    setPayables((prev) => prev.filter((p) => p.id !== payingRow.id))
    setPayingId(null)
    router.refresh()
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">Total owed</p>
          <p className="text-2xl font-bold">{formatCurrency(total)}</p>
        </div>

        <div className="hidden grid-cols-[1.3fr_1fr_1fr_1fr_1fr_100px_120px] gap-4 px-4 text-xs font-medium text-muted-foreground uppercase tracking-wide sm:grid">
          <span>Supplier</span>
          <span>PO</span>
          <span>Invoiced</span>
          <span>Due</span>
          <span>Amount Due</span>
          <span>Status</span>
          <span></span>
        </div>

        {payables.map((p) => {
          const overdueDays = daysUntil(p.due_date)
          const isOverdue = overdueDays != null && overdueDays < 0
          return (
            <Card key={p.id} className={cn("transition-colors hover:bg-accent/30", isOverdue && "border-destructive/40")}>
              <CardContent className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1fr_100px_120px] sm:items-center sm:gap-4">
                <Link href={`/finance/purchases/${p.id}`} className="min-w-0">
                  <p className="text-sm font-medium">{p.supplier_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.invoice_number ?? (p.received_bill_nos.length > 0 ? p.received_bill_nos.join(", ") : "No supplier bill #")}
                  </p>
                  {p.invoice_number && p.received_bill_nos.length > 0 && !p.received_bill_nos.includes(p.invoice_number) && (
                    <p className="truncate text-xs text-muted-foreground/70">Bill on receipt: {p.received_bill_nos.join(", ")}</p>
                  )}
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
                <Button size="sm" variant="outline" onClick={() => openPayDialog(p.id)}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark Paid
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!payingId} onOpenChange={(open) => !open && setPayingId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
          </DialogHeader>
          {payingRow && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-sm text-muted-foreground">{payingRow.supplier_name}</p>
                <p className="text-xl font-bold">{formatCurrency(payingRow.amount_due)}</p>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Payment Date</Label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>
              <div className="space-y-1.5">
                <Label>Reference (optional)</Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="UTR / cheque no. / transaction id"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tally Ledger *</Label>
                <Input
                  value={tallyLedger}
                  onChange={(e) => setTallyLedger(e.target.value)}
                  placeholder="e.g. HDFC Bank, Cash"
                />
                <p className="text-[11px] text-muted-foreground">
                  Which bank/cash ledger this payment posts against in Tally — defaults to the
                  ledger set in Settings, but can be changed for this payment.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayingId(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayment} disabled={submitting}>
              {submitting ? "Saving…" : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
