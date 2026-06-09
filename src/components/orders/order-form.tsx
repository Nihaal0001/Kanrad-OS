"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { orderSchema, type OrderFormData } from "@/lib/validators/order"
import { createOrder, updateOrder } from "@/actions/orders"
import { formatCurrency } from "@/lib/utils"
import type { OrderDetail } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { CustomerSelect } from "@/components/orders/customer-select"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface BomProduct {
  id: string
  name: string
  sku: string
  materialCost: number
}

interface OrderFormProps {
  order?: OrderDetail
  customers: Array<{ id: string; name: string; company: string | null }>
  products?: BomProduct[]
}

function formatCurrencyLocal(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function OrderForm({ order, customers, products = [] }: OrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!order

  const existingProduct = order?.order_items?.[0]
  const existingProductName = existingProduct?.product_variant ?? ""
  const existingQuantity = order?.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 1
  const existingUnitPrice = existingProduct?.unit_price ?? 0

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: order?.customer_id ?? "",
      description: order?.description ?? "",
      deadline: order?.deadline ?? "",
      priority: "normal",
      gst_rate: 18,
      notes: "",
      items: [{
        product_variant: existingProductName,
        size: "",
        color: "",
        quantity: existingQuantity,
        unit_price: existingUnitPrice,
        hsn_code: "",
        thickness_mm: null,
      }],
    },
  })

  const watchProduct = form.watch("items.0.product_variant")
  const watchQuantity = form.watch("items.0.quantity") || 0
  const watchUnitPrice = form.watch("items.0.unit_price") || 0
  const orderValue = watchQuantity * watchUnitPrice

  function handleProductChange(productName: string) {
    form.setValue("items.0.product_variant", productName, { shouldValidate: true })
    const product = products.find((p) => p.name === productName)
    if (product && product.materialCost > 0) {
      form.setValue("items.0.unit_price", Math.round(product.materialCost * 100) / 100)
    }
  }

  async function onSubmit(data: OrderFormData, asDraft?: boolean) {
    setIsSubmitting(true)
    setError(null)
    try {
      const submitData = {
        ...data,
        status: asDraft ? ("draft" as const) : (data.status ?? "confirmed" as const),
      }
      if (isEditing) {
        const result = await updateOrder(order.id, submitData)
        if (result && "error" in result && result.error) { setError(result.error); toast.error(result.error); return }
        toast.success("Order updated")
        router.push(`/orders/${order.id}`)
      } else {
        const result = await createOrder(submitData)
        if (result && "error" in result && result.error) { setError(result.error); toast.error(result.error); return }
        if (result && "data" in result && result.data) { toast.success("Order created"); router.push("/orders") }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg); toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit((data) => onSubmit(data))} className="space-y-6 max-w-xl">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Customer */}
          <div className="space-y-2">
            <Label>Customer</Label>
            <CustomerSelect
              value={form.watch("customer_id")}
              onChange={(value) => form.setValue("customer_id", value, { shouldValidate: true })}
              customers={customers}
              placeholder="Select a customer"
              addLabel="Manage Customers"
              addHref="/customers"
            />
            {form.formState.errors.customer_id && (
              <p className="text-sm text-destructive">{form.formState.errors.customer_id.message}</p>
            )}
          </div>

          {/* Product / BOM */}
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={watchProduct || ""} onValueChange={handleProductChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select product from BOM…" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    <span>{p.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.items?.[0]?.product_variant && (
              <p className="text-sm text-destructive">{form.formState.errors.items[0]?.product_variant?.message}</p>
            )}
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label>Deadline</Label>
            <Controller
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            {form.formState.errors.deadline && (
              <p className="text-sm text-destructive">{form.formState.errors.deadline.message}</p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Quantity (pcs)</Label>
            <Input
              type="number"
              min={1}
              placeholder="Enter quantity"
              {...form.register("items.0.quantity", { valueAsNumber: true })}
            />
            {form.formState.errors.items?.[0]?.quantity && (
              <p className="text-sm text-destructive">{form.formState.errors.items[0]?.quantity?.message}</p>
            )}
          </div>

          <Separator />

          {/* Order Value — auto-calculated */}
          <div className="rounded-lg bg-muted/40 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Order Value</span>
            <span className="text-xl font-bold tabular-nums">
              {orderValue > 0 ? `₹${formatCurrencyLocal(orderValue)}` : "—"}
            </span>
          </div>

        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.push("/orders")} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" disabled={isSubmitting}
          onClick={() => form.handleSubmit((data) => onSubmit(data, true))()}>
          {isSubmitting ? "Saving..." : "Save as Draft"}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEditing ? "Update Order" : "Create Order"}
        </Button>
      </div>
    </form>
  )
}
