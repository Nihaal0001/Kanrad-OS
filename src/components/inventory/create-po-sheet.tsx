"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X, Lock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { purchaseOrderSchema, type PurchaseOrderFormData } from "@/lib/validators/inventory"
import { createPurchaseOrder } from "@/actions/inventory"
import { formatCurrency } from "@/lib/utils"
import type { Material } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Props {
  materials: Array<Pick<Material, "id" | "name" | "sku" | "unit"> & { cost_per_unit: number }>
}

export function CreatePurchaseOrderSheet({ materials }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

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

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchItems = form.watch("items")

  const materialPriceMap = Object.fromEntries(materials.map((m) => [m.id, m.cost_per_unit]))
  function getPriceCeiling(materialId: string): number | null {
    const p = materialPriceMap[materialId]
    return p != null && p > 0 ? p : null
  }

  const totalValue = watchItems?.reduce(
    (sum, item) => sum + (Number(item.quantity_ordered) || 0) * (Number(item.unit_price) || 0),
    0
  ) ?? 0

  function handleOpen() {
    form.reset({
      supplier_name: "",
      supplier_contact: "",
      order_date: new Date().toISOString().split("T")[0],
      expected_date: "",
      notes: "",
      items: [{ material_id: "", quantity_ordered: 1, unit_price: 0 }],
    })
    setOpen(true)
  }

  function onSubmit(data: PurchaseOrderFormData) {
    for (const item of data.items) {
      const ceiling = getPriceCeiling(item.material_id)
      if (ceiling !== null && item.unit_price > ceiling) {
        const mat = materials.find((m) => m.id === item.material_id)
        toast.error(`Price for "${mat?.name}" (₹${item.unit_price}) exceeds max ₹${ceiling}`)
        return
      }
    }

    startTransition(async () => {
      const result = await createPurchaseOrder(data)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      if (result && "data" in result && result.data) {
        toast.success("Purchase order created")
        setOpen(false)
        router.push(`/inventory/purchase-orders/${result.data.id}`)
      }
    })
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        New Purchase Order
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>New Purchase Order</SheetTitle>
            <SheetDescription>Order materials from a supplier</SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Supplier */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Supplier Name *</Label>
                  <Input placeholder="Supplier name" {...form.register("supplier_name")} />
                  {form.formState.errors.supplier_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.supplier_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Contact</Label>
                  <Input placeholder="Phone or email" {...form.register("supplier_contact")} />
                </div>
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Order Date *</Label>
                  <Controller
                    control={form.control}
                    name="order_date"
                    render={({ field }) => (
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Delivery</Label>
                  <Controller
                    control={form.control}
                    name="expected_date"
                    render={({ field }) => (
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Additional notes…"
                  {...form.register("notes")}
                />
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Order Items</p>

                {fields.map((field, index) => {
                  const selectedId = form.watch(`items.${index}.material_id`)
                  const enteredPrice = form.watch(`items.${index}.unit_price`) || 0
                  const ceiling = getPriceCeiling(selectedId)
                  const exceeds = ceiling !== null && enteredPrice > ceiling

                  return (
                    <div key={field.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Item {index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          disabled={fields.length <= 1}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Material</Label>
                        <Select
                          value={selectedId}
                          onValueChange={(v) => form.setValue(`items.${index}.material_id`, v, { shouldValidate: true })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select material" />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name}
                                {m.cost_per_unit > 0 && (
                                  <span className="ml-2 text-xs text-muted-foreground">max ₹{m.cost_per_unit.toFixed(2)}</span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.items?.[index]?.material_id && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.material_id?.message}</p>
                        )}
                      </div>

                      <div className="grid gap-3 grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Quantity</Label>
                          <Input
                            type="number"
                            min={0.01}
                            step="0.01"
                            placeholder="Qty"
                            {...form.register(`items.${index}.quantity_ordered`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs flex items-center gap-1">
                            Unit Price <Lock className="h-3 w-3 text-muted-foreground" />
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="₹"
                              className={exceeds ? "border-destructive pr-8" : ""}
                              {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                            />
                            {exceeds && (
                              <AlertTriangle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive pointer-events-none" />
                            )}
                          </div>
                          {ceiling !== null && (
                            <p className={`text-xs ${exceeds ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                              Max: ₹{ceiling.toFixed(2)}
                              {exceeds && " — exceeds limit"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => append({ material_id: "", quantity_ordered: 1, unit_price: 0 })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>

                {totalValue > 0 && (
                  <div className="flex justify-between items-center pt-1 text-sm">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-semibold">{formatCurrency(totalValue)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Purchase Order"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
