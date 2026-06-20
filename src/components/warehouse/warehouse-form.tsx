"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { warehouseItemSchema } from "@/lib/validators/warehouse"
import type { WarehouseItemFormData } from "@/lib/validators/warehouse"
import { createWarehouseItem, type ProducedItem } from "@/actions/warehouse"
import { friendlyError } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const UNITS = ["pcs", "kg", "meters", "liters", "boxes", "rolls", "sets", "packs"]
const CATEGORIES = ["Cookware", "Kitchenware", "Storage", "Home Products", "Packaging", "Other"]

export function WarehouseForm({ producedItems }: { producedItems: ProducedItem[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<WarehouseItemFormData>({
    resolver: zodResolver(warehouseItemSchema),
    defaultValues: {
      item_name: "",
      sku: "",
      category: "",
      quantity: 0,
      unit: "pcs",
      location: "",
      remarks: "",
    },
  })

  function handleItemSelect(name: string) {
    const item = producedItems.find((p) => p.name === name)
    form.setValue("item_name", name, { shouldValidate: true })
    form.setValue("sku", item?.sku ?? "")
    if (item?.category) form.setValue("category", item.category)
  }

  async function onSubmit(data: WarehouseItemFormData) {
    const result = await createWarehouseItem(data)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Item added to warehouse")
    form.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Warehouse Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Produced Item *</Label>
              <Select value={form.watch("item_name") || ""} onValueChange={handleItemSelect}>
                <SelectTrigger>
                  <SelectValue placeholder={producedItems.length ? "Select a produced item" : "No produced items yet"} />
                </SelectTrigger>
                <SelectContent>
                  {producedItems.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      <span>{p.name}</span>
                      {p.sku && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {producedItems.length === 0 && (
                <p className="text-xs text-muted-foreground">Log production output on an order to make it available here.</p>
              )}
              {form.formState.errors.item_name && (
                <p className="text-xs text-destructive">{form.formState.errors.item_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" {...form.register("sku")} placeholder="—" readOnly className="bg-muted/50" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("category") || ""}
                onValueChange={(v) => form.setValue("category", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...form.register("location")} placeholder="e.g., Rack A, Shelf 2" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                step="0.001"
                {...form.register("quantity", { valueAsNumber: true })}
              />
              {form.formState.errors.quantity && (
                <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Unit *</Label>
              <Select
                value={form.watch("unit")}
                onValueChange={(v) => form.setValue("unit", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <textarea
              id="remarks"
              className="flex min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional remarks..."
              {...form.register("remarks")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Adding..." : "Add Item"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
