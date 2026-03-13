"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X } from "lucide-react"

import {
  purchaseOrderSchema,
  type PurchaseOrderFormData,
} from "@/lib/validators/inventory"
import { createPurchaseOrder } from "@/actions/inventory"
import { formatCurrency } from "@/lib/utils"
import type { Material } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface PurchaseOrderFormProps {
  materials: Array<Pick<Material, "id" | "name" | "sku" | "unit">>
}

export function PurchaseOrderForm({ materials }: PurchaseOrderFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplier_name: "",
      supplier_contact: "",
      order_date: new Date().toISOString().split("T")[0],
      expected_date: "",
      notes: "",
      items: [{ material_id: "", quantity_ordered: 1, unit_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchItems = form.watch("items")

  const totalValue =
    watchItems?.reduce(
      (sum, item) =>
        sum +
        (Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0),
      0
    ) ?? 0

  async function onSubmit(data: PurchaseOrderFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await createPurchaseOrder(data)
      if (result && "error" in result && result.error) {
        setError(result.error)
        return
      }
      if (result && "data" in result && result.data) {
        router.push(`/inventory/purchase-orders/${result.data.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Supplier Details */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Details</CardTitle>
          <CardDescription>Who are you ordering from?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Supplier Name</Label>
              <Input
                id="supplier_name"
                placeholder="Supplier name"
                {...form.register("supplier_name")}
              />
              {form.formState.errors.supplier_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.supplier_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_contact">Contact</Label>
              <Input
                id="supplier_contact"
                placeholder="Phone or email"
                {...form.register("supplier_contact")}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="order_date">Order Date</Label>
              <Input
                id="order_date"
                type="date"
                {...form.register("order_date")}
              />
              {form.formState.errors.order_date && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.order_date.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_date">Expected Delivery</Label>
              <Input
                id="expected_date"
                type="date"
                {...form.register("expected_date")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Additional notes..."
              {...form.register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Order Items */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
          <CardDescription>
            Materials to order from this supplier
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Column headers for desktop */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_100px_120px_40px] sm:gap-3 sm:px-1">
            <Label className="text-xs text-muted-foreground">Material</Label>
            <Label className="text-xs text-muted-foreground">Quantity</Label>
            <Label className="text-xs text-muted-foreground">Unit Price</Label>
            <span />
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="grid gap-3 sm:grid-cols-[1fr_100px_120px_40px] items-start"
            >
              {/* Material */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Material
                </Label>
                <Select
                  value={form.watch(`items.${index}.material_id`)}
                  onValueChange={(value) =>
                    form.setValue(`items.${index}.material_id`, value, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {materials.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.items?.[index]?.material_id && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.items[index]?.material_id?.message}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <Label className="sm:hidden text-xs text-muted-foreground">
                  Quantity
                </Label>
                <Input
                  type="number"
                  min={0.01}
                  step="0.01"
                  placeholder="Qty"
                  {...form.register(`items.${index}.quantity_ordered`, {
                    valueAsNumber: true,
                  })}
                />
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
              </div>

              {/* Remove */}
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
              append({ material_id: "", quantity_ordered: 1, unit_price: 0 })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>

          <Separator />

          <div className="flex justify-end">
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
          onClick={() => router.push("/inventory/purchase-orders")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Purchase Order"}
        </Button>
      </div>
    </form>
  )
}
