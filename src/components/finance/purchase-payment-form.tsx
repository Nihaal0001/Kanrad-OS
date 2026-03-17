"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"

import { toast } from "sonner"
import {
  purchasePaymentSchema,
  type PurchasePaymentFormData,
} from "@/lib/validators/purchase-invoices"
import { createPurchasePayment } from "@/actions/purchase-invoices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  upi: "UPI",
  other: "Other",
}

interface PurchasePaymentFormProps {
  purchaseInvoiceId: string
  invoiceNumber: string
  outstanding: number
}

export function PurchasePaymentForm({
  purchaseInvoiceId,
  invoiceNumber,
  outstanding,
}: PurchasePaymentFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PurchasePaymentFormData>({
    resolver: zodResolver(purchasePaymentSchema),
    defaultValues: {
      purchase_invoice_id: purchaseInvoiceId,
      amount: outstanding > 0 ? outstanding : undefined,
      method: "bank_transfer",
      reference: "",
      payment_date: today,
      notes: "",
    },
  })

  const method = watch("method")

  async function onSubmit(data: PurchasePaymentFormData) {
    setLoading(true)
    const result = await createPurchasePayment(data)
    setLoading(false)

    if ("error" in result && result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Payment recorded")
    reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Record Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pay — {invoiceNumber || "Purchase Invoice"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-amount">Amount (₹) *</Label>
            <Input
              id="p-amount"
              type="number"
              min="0.01"
              step="0.01"
              {...register("amount", { valueAsNumber: true })}
            />
            {outstanding > 0 && (
              <p className="text-xs text-muted-foreground">
                Outstanding: ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            )}
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Payment Method *</Label>
            <Select
              value={method}
              onValueChange={(v) => setValue("method", v as PurchasePaymentFormData["method"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-date">Payment Date *</Label>
            <Controller
              control={control}
              name="payment_date"
              render={({ field }) => (
                <DatePicker value={field.value} onChange={field.onChange} />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-ref">Reference / Transaction ID</Label>
            <Input id="p-ref" {...register("reference")} placeholder="UTR, cheque number, etc." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea id="p-notes" {...register("notes")} rows={2} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
