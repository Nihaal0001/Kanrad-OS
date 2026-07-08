"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { PackageCheck } from "lucide-react"

import { warehouseDispatchSchema } from "@/lib/validators/logistics"
import type { WarehouseDispatchFormData } from "@/lib/validators/logistics"
import { dispatchToOrder } from "@/actions/logistics"
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

interface WarehouseStock {
  warehouse_item_id: string
  item_name: string
  sku: string | null
  quantity: number
  unit: string
  order_id: string | null
  order_number: string | null
  customer_name: string | null
}

interface WarehouseDispatchFormProps {
  stock: WarehouseStock[]
}

export function WarehouseDispatchForm({ stock }: WarehouseDispatchFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<WarehouseDispatchFormData>({
    resolver: zodResolver(warehouseDispatchSchema),
    defaultValues: { order_id: "", quantity: 0, notes: "" },
  })

  const selectedOrderId = form.watch("order_id")
  const selected = stock.find((s) => s.order_id === selectedOrderId)

  function handleOpenChange(v: boolean) {
    if (v) form.reset({ order_id: "", quantity: 0, notes: "" })
    setOpen(v)
  }

  async function onSubmit(data: WarehouseDispatchFormData) {
    const result = await dispatchToOrder(data)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Dispatched to order")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={stock.length === 0}>
          <PackageCheck className="h-4 w-4" />
          Dispatch to Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispatch Warehouse Stock to an Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Order *</Label>
            <Select
              value={selectedOrderId || ""}
              onValueChange={(v) => {
                form.setValue("order_id", v, { shouldValidate: true })
                form.setValue("quantity", 0)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an order with warehouse stock" />
              </SelectTrigger>
              <SelectContent>
                {stock.map((s) => (
                  <SelectItem key={s.order_id} value={s.order_id!}>
                    {s.order_number} — {s.item_name}
                    {s.customer_name ? ` (${s.customer_name})` : ""} · {s.quantity} {s.unit} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.order_id && (
              <p className="text-xs text-destructive">{form.formState.errors.order_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity to dispatch {selected ? `(max ${selected.quantity} ${selected.unit})` : ""}
            </Label>
            <Input
              id="quantity"
              type="number"
              min={0.01}
              step="0.01"
              max={selected?.quantity}
              disabled={!selected}
              {...form.register("quantity", { valueAsNumber: true })}
            />
            {form.formState.errors.quantity && (
              <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Optional notes..."
              {...form.register("notes")}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting || !selected}>
              {form.formState.isSubmitting ? "Dispatching..." : "Dispatch"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
