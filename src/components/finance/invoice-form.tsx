"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2 } from "lucide-react"

import { toast } from "sonner"
import { invoiceSchema, type InvoiceFormData } from "@/lib/validators/finance"
import { createInvoice, getOrderForInvoice } from "@/actions/finance"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
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

const INDIAN_STATES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
]

// Map GSTIN prefix (2 chars) to state name
const GSTIN_STATE: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
  "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
  "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
  "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh",
}

interface SelectableOrder {
  id: string
  order_number: string
  product_variant: string
  customer: { id: string; name: string } | null
}

interface InvoiceFormProps {
  orders: SelectableOrder[]
  preloadedOrder?: Awaited<ReturnType<typeof getOrderForInvoice>>
  preloadedOrderId?: string
  orgGstin?: string
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function InvoiceForm({ orders, preloadedOrder, preloadedOrderId, orgGstin }: InvoiceFormProps) {
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
      customer_id: preloadedOrder?.customer?.id ?? "",
      customer_name: preloadedOrder?.customer?.name ?? "",
      customer_address: preloadedOrder?.customer?.address ?? "",
      customer_gst: preloadedOrder?.customer?.gst_number ?? "",
      tax_rate: 0,
      place_of_supply: "",
      reverse_charge: false,
      is_igst: false,
      issue_date: today,
      due_date: "",
      notes: "",
      items: preloadedOrder?.order_items.map((oi) => ({
        description: `${oi.product_variant} — ${oi.size} / ${oi.color}`,
        quantity: oi.quantity,
        unit_price: oi.unit_price,
        hsn_code: "",
      })) ?? [{ description: "", quantity: 1, unit_price: 0, hsn_code: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "items" })

  const watchedItems = watch("items")
  const taxRate = watch("tax_rate") ?? 0
  const isIgst = watch("is_igst") ?? false
  const customerGst = watch("customer_gst") ?? ""
  const reverseCharge = watch("reverse_charge") ?? false

  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  )
  const taxAmount = (subtotal * (Number(taxRate) || 0)) / 100
  const halfTax = taxAmount / 2
  const halfRate = (Number(taxRate) || 0) / 2
  const total = subtotal + taxAmount

  // Auto-detect IGST vs CGST+SGST from GSTIN state codes
  useEffect(() => {
    if (orgGstin && customerGst && customerGst.length >= 2 && orgGstin.length >= 2) {
      const orgState = orgGstin.slice(0, 2)
      const customerState = customerGst.slice(0, 2)
      setValue("is_igst", orgState !== customerState)
      // Auto-set Place of Supply from customer GSTIN
      const pos = GSTIN_STATE[customerState]
      if (pos) setValue("place_of_supply", pos)
    }
  }, [customerGst, orgGstin, setValue])

  const handleOrderChange = useCallback(
    async (orderId: string) => {
      setValue("order_id", orderId)
      if (!orderId) return

      setLoadingOrder(true)
      const order = await getOrderForInvoice(orderId)
      setLoadingOrder(false)

      if (!order) return

      setValue("customer_id", order.customer?.id ?? "")
      setValue("customer_name", order.customer?.name ?? "")
      setValue("customer_address", order.customer?.address ?? "")
      setValue("customer_gst", order.customer?.gst_number ?? "")

      if (order.order_items.length > 0) {
        const items = order.order_items.map((oi) => ({
          description: `${oi.product_variant} — ${oi.size} / ${oi.color}`,
          quantity: oi.quantity,
          unit_price: oi.unit_price,
          hsn_code: "",
        }))
        setValue("items", items)
      }
    },
    [setValue]
  )

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
      toast.error(result.error)
      return
    }

    toast.success("Invoice created")
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
                      {o.order_number} · {o.product_variant}
                      {o.customer ? ` (${o.customer.name})` : ""}
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

        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Customer / Bill To</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer_name">Customer Name *</Label>
              <Input id="customer_name" {...register("customer_name")} placeholder="Customer name" />
              {errors.customer_name && (
                <p className="text-xs text-destructive">{errors.customer_name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer_address">Address</Label>
              <Textarea
                id="customer_address"
                {...register("customer_address")}
                placeholder="Billing address"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customer_gst">GSTIN</Label>
              <Input id="customer_gst" {...register("customer_gst")} placeholder="22AAAAA0000A1Z5" />
              <p className="text-xs text-muted-foreground">
                IGST/CGST+SGST is auto-detected from state code when GSTIN is entered.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="issue_date">Issue Date *</Label>
              <Controller
                control={control}
                name="issue_date"
                render={({ field }) => (
                  <DatePicker value={field.value} onChange={field.onChange} />
                )}
              />
              {errors.issue_date && (
                <p className="text-xs text-destructive">{errors.issue_date.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due_date">Due Date</Label>
              <Controller
                control={control}
                name="due_date"
                render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tax_rate">GST Rate (%)</Label>
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
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="place_of_supply">Place of Supply</Label>
              <Select
                defaultValue="none"
                onValueChange={(v) => setValue("place_of_supply", v === "none" ? "" : v)}
              >
                <SelectTrigger id="place_of_supply">
                  <SelectValue placeholder="Select state…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Select state —</SelectItem>
                  {INDIAN_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Required on all GST invoices (Rule 46)</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="is_igst"
                  className="h-4 w-4 rounded"
                  {...register("is_igst")}
                />
                <Label htmlFor="is_igst" className="font-normal cursor-pointer">
                  Interstate supply (IGST)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reverse_charge"
                  className="h-4 w-4 rounded"
                  {...register("reverse_charge")}
                />
                <Label htmlFor="reverse_charge" className="font-normal cursor-pointer">
                  Reverse charge applicable
                </Label>
              </div>
            </div>
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
            onClick={() => append({ description: "", quantity: 1, unit_price: 0, hsn_code: "" })}
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.items && typeof errors.items.message === "string" && (
            <p className="text-xs text-destructive">{errors.items.message}</p>
          )}

          <div className="hidden grid-cols-[90px_1fr_70px_110px_40px] gap-2 text-xs font-medium text-muted-foreground sm:grid">
            <span>HSN/SAC</span>
            <span>Description</span>
            <span>Qty</span>
            <span>Unit Price (Rs.)</span>
            <span />
          </div>

          {fields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-[90px_1fr_70px_110px_40px] items-start gap-2">
              <Input
                {...register(`items.${idx}.hsn_code`)}
                placeholder="e.g. 6109"
              />
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

          {/* Totals preview */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>Rs. {formatCurrency(subtotal)}</span>
            </div>
            {isIgst ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IGST ({Number(taxRate) || 0}%)</span>
                <span>Rs. {formatCurrency(taxAmount)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST ({halfRate}%)</span>
                  <span>Rs. {formatCurrency(halfTax)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST ({halfRate}%)</span>
                  <span>Rs. {formatCurrency(halfTax)}</span>
                </div>
              </>
            )}
            {reverseCharge && (
              <div className="flex justify-between text-amber-600 text-xs">
                <span>* Tax payable on reverse charge basis</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-base pt-1 border-t border-border">
              <span>Total</span>
              <span>Rs. {formatCurrency(total)}</span>
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
