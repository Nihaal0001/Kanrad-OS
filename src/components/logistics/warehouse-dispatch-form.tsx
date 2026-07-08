"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { PackageCheck } from "lucide-react"

import { warehouseDispatchSchema } from "@/lib/validators/logistics"
import type { WarehouseDispatchFormData } from "@/lib/validators/logistics"
import { shipWarehouseStock } from "@/actions/logistics"
import { friendlyError, formatCurrency } from "@/lib/utils"
import { formatCartons } from "@/lib/master-cartons"

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
  unit_price: number
  order_id: string | null
  order_number: string | null
  customer_name: string | null
  customer_phone: string | null
  master_cartons: number | null
}

interface WarehouseDispatchFormProps {
  stock: WarehouseStock[]
}

const emptyDefaults: WarehouseDispatchFormData = {
  order_id: "",
  quantity: 0,
  bill_no: "",
  customer_name: "",
  customer_contact: "",
  courier_name: "",
  tracking_number: "",
  expected_delivery_date: "",
  notes: "",
}

export function WarehouseDispatchForm({ stock }: WarehouseDispatchFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<WarehouseDispatchFormData>({
    resolver: zodResolver(warehouseDispatchSchema),
    defaultValues: emptyDefaults,
  })

  const selectedOrderId = form.watch("order_id")
  const quantity = form.watch("quantity") || 0
  const selected = stock.find((s) => s.order_id === selectedOrderId)
  const value = selected ? Math.round(selected.unit_price * quantity * 100) / 100 : 0
  const cartons = selected && selected.master_cartons != null && selected.quantity > 0
    ? Math.round((selected.master_cartons / selected.quantity) * quantity * 1000) / 1000
    : null

  function handleOpenChange(v: boolean) {
    if (v) form.reset(emptyDefaults)
    setOpen(v)
  }

  function handleOrderChange(orderId: string) {
    const s = stock.find((s) => s.order_id === orderId)
    form.setValue("order_id", orderId, { shouldValidate: true })
    form.setValue("quantity", 0)
    form.setValue("customer_name", s?.customer_name ?? "")
    form.setValue("customer_contact", s?.customer_phone ?? "")
  }

  async function onSubmit(data: WarehouseDispatchFormData) {
    const result = await shipWarehouseStock(data)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Shipped — invoice raised in Receivables")
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={stock.length === 0}>
          <PackageCheck className="h-4 w-4" />
          Ship the Order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ship Finished Goods to an Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Order *</Label>
            <Select value={selectedOrderId || ""} onValueChange={handleOrderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select an order with finished stock ready to ship" />
              </SelectTrigger>
              <SelectContent>
                {stock.map((s) => (
                  <SelectItem key={s.order_id} value={s.order_id!}>
                    {s.order_number} — {s.item_name}
                    {s.customer_name ? ` (${s.customer_name})` : ""} · {s.quantity} {s.unit}
                    {s.master_cartons != null ? ` (${formatCartons(s.master_cartons)} MC)` : ""} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.order_id && (
              <p className="text-xs text-destructive">{form.formState.errors.order_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">
                Quantity {selected ? `(max ${selected.quantity} ${selected.unit})` : ""}
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
              {cartons != null && (
                <p className="text-xs text-muted-foreground">≈ {formatCartons(cartons)} master cartons</p>
              )}
              {form.formState.errors.quantity && (
                <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium">
                {formatCurrency(value)}
              </div>
              <p className="text-xs text-muted-foreground">Auto-calculated from the order&apos;s price</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bill_no">Bill No. *</Label>
            <Input id="bill_no" placeholder="Invoice / bill number" {...form.register("bill_no")} />
            {form.formState.errors.bill_no && (
              <p className="text-xs text-destructive">{form.formState.errors.bill_no.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input id="customer_name" {...form.register("customer_name")} placeholder="Consignee name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer_contact">Customer Contact</Label>
              <Input id="customer_contact" {...form.register("customer_contact")} placeholder="Phone number" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="courier_name">Transporter</Label>
              <Input id="courier_name" {...form.register("courier_name")} placeholder="e.g., Blue Dart" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tracking_number">Tracking Number</Label>
              <Input id="tracking_number" {...form.register("tracking_number")} placeholder="AWB / tracking ID" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected_delivery_date">Expected Delivery</Label>
            <Input id="expected_delivery_date" type="date" {...form.register("expected_delivery_date")} />
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
              {form.formState.isSubmitting ? "Shipping..." : "Ship"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
