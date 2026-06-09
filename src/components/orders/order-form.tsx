"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X } from "lucide-react"

import { toast } from "sonner"
import { orderSchema, type OrderFormData } from "@/lib/validators/order"
import { createOrder, updateOrder } from "@/actions/orders"
import { formatCurrency } from "@/lib/utils"
import { isIBCoating, isCircleKgItem, kgToPieces } from "@/lib/circle-calc"
import type { OrderDetail } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DatePicker } from "@/components/ui/date-picker"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
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
import { CustomerSelect } from "@/components/orders/customer-select"

interface OrderFormProps {
  order?: OrderDetail
  customers: Array<{ id: string; name: string; company: string | null }>
  products?: Array<{ id: string; name: string; sku: string }>
}

export function OrderForm({ order, customers, products = [] }: OrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!order

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: order?.customer_id ?? "",
      description: order?.description ?? "",
      deadline: order?.deadline ?? "",
      priority: order?.priority ?? "normal",
      gst_rate: 18,
      notes: order?.notes ?? "",
      items: order?.order_items?.length
        ? order.order_items.map((item) => ({
            product_variant: item.product_variant ?? order.product_variant ?? "",
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unit_price: item.unit_price,
            hsn_code: item.hsn_code ?? "",
            thickness_mm: (item as { thickness_mm?: number | null }).thickness_mm ?? null,
          }))
        : [{ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "", thickness_mm: null }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchItems = form.watch("items")

  const totalQuantity = watchItems?.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0),
    0
  ) ?? 0

  const totalValue = watchItems?.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
    0
  ) ?? 0

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
        if (result && "error" in result && result.error) {
          setError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("Order updated")
        router.push(`/orders/${order.id}`)
      } else {
        const result = await createOrder(submitData)
        if (result && "error" in result && result.error) {
          setError(result.error)
          toast.error(result.error)
          return
        }
        if (result && "data" in result && result.data) {
          toast.success("Order created")
          router.push("/orders")
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit((data) => onSubmit(data))}
      className="space-y-6"
    >
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Order Details */}
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>
            Basic information about the production order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer_id">Customer</Label>
            <CustomerSelect
              value={form.watch("customer_id")}
              onChange={(value) => form.setValue("customer_id", value, { shouldValidate: true })}
              customers={customers}
              placeholder="Select a customer"
              addLabel="Manage Customers"
              addHref="/customers"
            />
            {form.formState.errors.customer_id && (
              <p className="text-sm text-destructive">
                {form.formState.errors.customer_id.message}
              </p>
            )}
          </div>


          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Order description..."
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Controller
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              {form.formState.errors.deadline && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.deadline.message}
                </p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.watch("priority")}
                onValueChange={(value) =>
                  form.setValue("priority", value as OrderFormData["priority"], {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.priority && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.priority.message}
                </p>
              )}
            </div>
          </div>

          {/* GST Rate */}
          <div className="space-y-2">
            <Label htmlFor="gst_rate">GST Rate (%)</Label>
            <Select
              value={String(form.watch("gst_rate") ?? 18)}
              onValueChange={(value) =>
                form.setValue("gst_rate", Number(value), { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select GST rate" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0% — Exempt</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="12">12%</SelectItem>
                <SelectItem value="18">18%</SelectItem>
                <SelectItem value="28">28%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Additional notes..."
              {...form.register("notes")}
            />
            {form.formState.errors.notes && (
              <p className="text-sm text-destructive">
                {form.formState.errors.notes.message}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Size & Color Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Order Line Items</CardTitle>
          <CardDescription>
            Add product, size, and coating details for each line item
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Column headers for desktop */}
          <div className="hidden sm:grid sm:grid-cols-[1.3fr_0.7fr_0.6fr_0.7fr_90px_90px_120px_40px] sm:gap-3 sm:px-1">
            <Label className="text-xs text-muted-foreground">Product</Label>
            <Label className="text-xs text-muted-foreground">Size / Dia (mm)</Label>
            <Label className="text-xs text-muted-foreground">Thick (mm)</Label>
            <Label className="text-xs text-muted-foreground">Coating / Finish</Label>
            <Label className="text-xs text-muted-foreground">HSN/SAC</Label>
            <Label className="text-xs text-muted-foreground">Qty / kg</Label>
            <Label className="text-xs text-muted-foreground">Unit Price</Label>
            <span />
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 sm:grid-cols-[1.3fr_0.7fr_0.6fr_0.7fr_90px_90px_120px_40px] items-start"
            >
              {/* Product — from BOM only */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Product
                </Label>
                <Select
                  value={form.watch(`items.${index}.product_variant`) || ""}
                  onValueChange={(val) => form.setValue(`items.${index}.product_variant`, val, { shouldValidate: true })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product…" />
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
                {form.formState.errors.items?.[index]?.product_variant && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items[index]?.product_variant?.message}
                  </p>
                )}
              </div>

              {/* Size / Diameter */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Size / Dia (mm)
                </Label>
                <Input
                  placeholder="e.g., 240"
                  {...form.register(`items.${index}.size`)}
                />
                {form.formState.errors.items?.[index]?.size && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items[index]?.size?.message}
                  </p>
                )}
              </div>

              {/* Thickness — for non-IB circle weight calculation */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Thick (mm)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g., 3"
                  {...form.register(`items.${index}.thickness_mm`, {
                    valueAsNumber: true,
                    setValueAs: (v) => (v === "" || isNaN(v) ? null : Number(v)),
                  })}
                />
              </div>

              {/* Coating / Finish */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Coating / Finish
                </Label>
                <Input
                  placeholder="e.g., Nonstick, IB"
                  {...form.register(`items.${index}.color`)}
                />
                {form.formState.errors.items?.[index]?.color && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items[index]?.color?.message}
                  </p>
                )}
              </div>

              {/* HSN/SAC Code */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">HSN/SAC</Label>
                <Input
                  placeholder="e.g. 7615"
                  {...form.register(`items.${index}.hsn_code`)}
                />
              </div>

              {/* Quantity — shows "kg" unit for non-IB circle items */}
              <div className="space-y-1">
                {(() => {
                  const item = watchItems?.[index]
                  const unit = isCircleKgItem(item?.thickness_mm, item?.color) ? "kg" : "pcs"
                  return (
                    <Label className="sm:hidden text-xs text-muted-foreground">
                      Quantity ({unit})
                    </Label>
                  )
                })()}
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    className="pr-8"
                    {...form.register(`items.${index}.quantity`, {
                      valueAsNumber: true,
                    })}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {isCircleKgItem(watchItems?.[index]?.thickness_mm, watchItems?.[index]?.color) ? "kg" : "pcs"}
                  </span>
                </div>
                {form.formState.errors.items?.[index]?.quantity && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items[index]?.quantity?.message}
                  </p>
                )}
                {/* Show piece count for non-IB circle items */}
                {(() => {
                  const item = watchItems?.[index]
                  if (!isCircleKgItem(item?.thickness_mm, item?.color)) return null
                  const pcs = kgToPieces(item?.quantity, item?.size, item?.thickness_mm, item?.color)
                  if (!pcs) return null
                  return <p className="text-xs font-medium text-foreground">≈ {pcs.toLocaleString()} pcs</p>
                })()}
              </div>

              {/* Unit Price */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Unit Price
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price"
                  {...form.register(`items.${index}.unit_price`, {
                    valueAsNumber: true,
                  })}
                />
                {form.formState.errors.items?.[index]?.unit_price && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items[index]?.unit_price?.message}
                  </p>
                )}
              </div>

              {/* Remove button */}
              <div className="flex items-center pt-1 sm:pt-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove item</span>
                </Button>
              </div>
            </div>
          ))}

          {form.formState.errors.items?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.items.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "", thickness_mm: null })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>

          <Separator />

          {/* Totals */}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-8">
            <div className="text-sm">
              <span className="text-muted-foreground">Total Quantity: </span>
              <span className="font-semibold">
                {totalQuantity}{" "}
                {watchItems?.every((item) => isCircleKgItem(item.thickness_mm, item.color))
                  ? "kg"
                  : watchItems?.some((item) => isCircleKgItem(item.thickness_mm, item.color))
                  ? "mixed"
                  : "pcs"}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Total Value: </span>
              <span className="font-semibold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/orders")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={isSubmitting}
          onClick={() => form.handleSubmit((data) => onSubmit(data, true))()}
        >
          {isSubmitting ? "Saving..." : "Save as Draft"}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : isEditing
            ? "Update Order"
            : "Create Order"}
        </Button>
      </div>
    </form>
  )
}
