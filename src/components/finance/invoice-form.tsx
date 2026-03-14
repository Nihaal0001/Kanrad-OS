"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2 } from "lucide-react"

import { invoiceSchema, type InvoiceFormData } from "@/lib/validators/finance"
import { createInvoice, getOrderForInvoice } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

interface SelectableOrder {
  id: string
  order_number: string
  style_name: string
  buyer: { id: string; name: string } | null
}

interface InvoiceFormProps {
  orders: SelectableOrder[]
  preloadedOrder?: Awaited<ReturnType<typeof getOrderForInvoice>>
  preloadedOrderId?: string
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InvoiceForm({ orders, preloadedOrder, preloadedOrderId }: InvoiceFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingOrder, setLoadingOrder] = useState(false)

  const today = new Date().toISOString().split("T")[0]

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      order_id: preloadedOrderId ?? "",
      buyer_id: preloadedOrder?.buyer?.id ?? "",
      buyer_name: preloadedOrder?.buyer?.name ?? "",
      buyer_address: "",
      buyer_gst: "",
      tax_rate: 0,
      issue_date: today,
      due_date: "",
      notes: "",
      items: preloadedOrder?.order_items.map((oi) => ({
        description: `${oi.size} / ${oi.color} — ${preloadedOrder.style_name}`,
        quantity: oi.quantity,
        unit_price: oi.unit_price,
      })) ?? [{ description: "", quantity: 1, unit_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  const watchedItems = watch("items")
  const taxRate = watch("tax_rate") ?? 0
  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  )
  const taxAmount = (subtotal * (Number(taxRate) || 0)) / 100
  const total = subtotal + taxAmount

  const handleOrderChange = useCallback(
    async (orderId: string) => {
      setValue("order_id", orderId)
      if (!orderId) return

      setLoadingOrder(true)
      const order = await getOrderForInvoice(orderId)
      setLoadingOrder(false)

      if (!order) return

      setValue("buyer_id", order.buyer?.id ?? "")
      setValue("buyer_name", order.buyer?.name ?? "")

      // Pre-fill items from order_items
      if (order.order_items.length > 0) {
        const items = order.order_items.map((oi) => ({
          description: `${oi.size} / ${oi.color} — ${order.style_name}`,
          quantity: oi.quantity,
          unit_price: oi.unit_price,
        }))
        setValue("items", items)
      }
    },
    [setValue]
  )

  // If a preloaded order ID was provided via URL, trigger a load only if no preloaded data
  useEffect(() => {
    if (preloadedOrderId && !preloadedOrder) {
      handleOrderChange(preloadedOrderId)
    }
  }, [preloadedOrderId, preloadedOrder, handleOrderChange])

  async function onSubmit(data: InvoiceFormData) {
    setLoading(true)
    setError(null)
    const result = await createInvoice(data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.push(`/finance/invoices/${result.data.id}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Order Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Order (optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Link to Order</Label>
              <Select
                defaultValue={preloadedOrderId ?? "none"}
                onValueChange={(v) => handleOrderChange(v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a completed order…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No order —</SelectItem>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number} · {o.style_name}
                      {o.buyer ? ` (${o.buyer.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingOrder && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading order…
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Buyer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Buyer / Bill To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="buyer_name">Buyer Name *</Label>
              <Input id="buyer_name" {...register("buyer_name")} placeholder="Buyer name" />
              {errors.buyer_name && (
                <p className="text-xs text-destructive">{errors.buyer_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer_address">Address</Label>
              <Textarea
                id="buyer_address"
                {...register("buyer_address")}
                placeholder="Billing address"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buyer_gst">GST Number</Label>
              <Input id="buyer_gst" {...register("buyer_gst")} placeholder="22AAAAA0000A1Z5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="issue_date">Issue Date *</Label>
            <Input id="issue_date" type="date" {...register("issue_date")} />
            {errors.issue_date && (
              <p className="text-xs text-destructive">{errors.issue_date.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due_date">Due Date</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax_rate">GST / Tax Rate (%)</Label>
            <Input
              id="tax_rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register("tax_rate", { valueAsNumber: true })}
              placeholder="0"
            />
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line Items</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ description: "", quantity: 1, unit_price: 0 })}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.items && typeof errors.items.message === "string" && (
            <p className="text-xs text-destructive">{errors.items.message}</p>
          )}

          <div className="hidden grid-cols-[1fr_80px_120px_40px] gap-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Unit Price (₹)</span>
            <span />
          </div>

          {fields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-[1fr_80px_120px_40px] items-start gap-2">
              <div>
                <Input
                  {...register(`items.${idx}.description`)}
                  placeholder="Item description"
                />
                {errors.items?.[idx]?.description && (
                  <p className="text-xs text-destructive mt-0.5">
                    {errors.items[idx]?.description?.message}
                  </p>
                )}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                placeholder="1"
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                {...register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                placeholder="0.00"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => remove(idx)}
                disabled={fields.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Separator />

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>₹{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax ({Number(taxRate) || 0}%)</span>
              <span>₹{formatCurrency(taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span>₹{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes / Terms</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          placeholder="Payment terms, bank details, thank-you note…"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Invoice
        </Button>
      </div>
    </form>
  )
}
