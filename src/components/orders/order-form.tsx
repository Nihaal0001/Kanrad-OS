"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { orderSchema, type OrderFormData } from "@/lib/validators/order"
import { createOrder, updateOrder } from "@/actions/orders"
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
import { ProductSelect } from "@/components/orders/product-select"
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

  const existingItems = order?.order_items?.map((i) => ({
    product_variant: i.product_variant ?? "",
    size: i.size ?? "",
    color: i.color ?? "",
    quantity: i.quantity,
    unit_price: i.unit_price,
    hsn_code: "",
    thickness_mm: null,
  }))

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: order?.customer_id ?? "",
      description: order?.description ?? "",
      deadline: order?.deadline ?? "",
      priority: "normal",
      gst_rate: 18,
      notes: "",
      items: existingItems?.length
        ? existingItems
        : [{ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "", thickness_mm: null }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })

  const watchedItems = form.watch("items")
  const orderValue = watchedItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  )

  function handleProductChange(idx: number, productName: string) {
    form.setValue(`items.${idx}.product_variant`, productName, { shouldValidate: true })
    const product = products.find((p) => p.name === productName)
    if (product && product.materialCost > 0) {
      form.setValue(`items.${idx}.unit_price`, Math.round(product.materialCost * 100) / 100)
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
    <form onSubmit={form.handleSubmit((data) => onSubmit(data))} className="space-y-6 max-w-2xl">
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

        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Products</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "", thickness_mm: null })}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.formState.errors.items && typeof form.formState.errors.items.message === "string" && (
            <p className="text-sm text-destructive">{form.formState.errors.items.message}</p>
          )}

          {fields.map((field, idx) => {
            const itemErrors = form.formState.errors.items?.[idx]
            return (
              <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label>Product</Label>
                    <ProductSelect
                      value={form.watch(`items.${idx}.product_variant`) || ""}
                      onChange={(v) => handleProductChange(idx, v)}
                      products={products}
                      placeholder="Select product from BOM…"
                    />
                    {itemErrors?.product_variant && (
                      <p className="text-sm text-destructive">{itemErrors.product_variant.message}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(idx)}
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>Size</Label>
                    <Input {...form.register(`items.${idx}.size`)} placeholder="e.g. M" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Color</Label>
                    <Input {...form.register(`items.${idx}.color`)} placeholder="e.g. Silver" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Quantity (pcs)</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Enter quantity"
                      {...form.register(`items.${idx}.quantity`, { valueAsNumber: true })}
                    />
                    {itemErrors?.quantity && (
                      <p className="text-sm text-destructive">{itemErrors.quantity.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Unit Price (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      {...form.register(`items.${idx}.unit_price`, { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>
            )
          })}

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
