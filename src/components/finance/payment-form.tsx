"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus } from "lucide-react"

import { toast } from "sonner"
import { paymentSchema, type PaymentFormData } from "@/lib/validators/finance"
import { createPayment } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface PaymentFormProps {
  invoiceId: string
  invoiceNumber: string
  outstanding: number
  trigger?: React.ReactNode
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  upi: "UPI",
  other: "Other",
}

export function PaymentForm({ invoiceId, invoiceNumber, outstanding, trigger }: PaymentFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      invoice_id: invoiceId,
      amount: outstanding > 0 ? outstanding : undefined,
      method: "bank_transfer",
      reference: "",
      payment_date: today,
      notes: "",
    },
  })

  const method = watch("method")

  async function onSubmit(data: PaymentFormData) {
    setLoading(true)
    setError(null)
    const result = await createPayment(data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
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
        {trigger ?? (
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Record Payment
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment — {invoiceNumber}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount (₹) *</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              {...register("amount", { valueAsNumber: true })}
              placeholder="0.00"
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
              onValueChange={(v) => setValue("method", v as PaymentFormData["method"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment_date">Payment Date *</Label>
            <Input id="payment_date" type="date" {...register("payment_date")} />
            {errors.payment_date && (
              <p className="text-xs text-destructive">{errors.payment_date.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reference">Reference / Transaction ID</Label>
            <Input
              id="reference"
              {...register("reference")}
              placeholder="UTR, cheque number, etc."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...register("notes")} rows={2} placeholder="Optional notes" />
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
