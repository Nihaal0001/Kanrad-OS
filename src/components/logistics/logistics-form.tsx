"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { shipmentSchema } from "@/lib/validators/logistics"
import type { ShipmentFormData } from "@/lib/validators/logistics"
import { createShipment } from "@/actions/logistics"
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

interface Order {
  id: string
  order_number: string
  product_variant: string | null
  customer: { name: string } | null
}

interface LogisticsFormProps {
  orders: Order[]
}

export function LogisticsForm({ orders }: LogisticsFormProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const form = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      order_id: "",
      customer_name: "",
      courier_name: "",
      tracking_number: "",
      expected_delivery_date: "",
      notes: "",
    },
  })

  async function onSubmit(data: ShipmentFormData) {
    const result = await createShipment(data)
    if ("error" in result && result.error) {
      toast.error(friendlyError(result.error))
      return
    }
    toast.success("Shipment created")
    form.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          New Shipment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Shipment</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Order (optional)</Label>
            <Select
              value={form.watch("order_id") || ""}
              onValueChange={(v) => form.setValue("order_id", v === "__none__" ? "" : v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- No order --</SelectItem>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.order_number}
                    {o.customer?.name ? ` — ${o.customer.name}` : ""}
                    {o.product_variant ? ` (${o.product_variant})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer_name">Customer Name</Label>
              <Input id="customer_name" {...form.register("customer_name")} placeholder="Customer / consignee" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="courier_name">Courier Name</Label>
              <Input id="courier_name" {...form.register("courier_name")} placeholder="e.g., Blue Dart" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tracking_number">Tracking Number</Label>
              <Input id="tracking_number" {...form.register("tracking_number")} placeholder="AWB / tracking ID" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected_delivery_date">Expected Delivery</Label>
              <Input id="expected_delivery_date" type="date" {...form.register("expected_delivery_date")} />
            </div>
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
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating..." : "Create Shipment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
