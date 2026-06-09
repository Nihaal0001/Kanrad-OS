"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import { orderSchema, type OrderFormData } from "@/lib/validators/order"
import { createOrder } from "@/actions/orders"

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
import { CustomerSelect } from "@/components/orders/customer-select"
import { useState } from "react"

interface BomProduct {
  id: string
  name: string
  sku: string
  materialCost: number
}

interface Props {
  customers: Array<{ id: string; name: string; company: string | null }>
  products?: BomProduct[]
}

function fmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CreateOrderSheet({ customers, products = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customer_id: "",
      description: "",
      deadline: "",
      priority: "normal",
      gst_rate: 18,
      notes: "",
      items: [{ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "", thickness_mm: null }],
    },
  })

  const watchProduct = form.watch("items.0.product_variant")
  const watchQty = form.watch("items.0.quantity") || 0
  const watchPrice = form.watch("items.0.unit_price") || 0
  const orderValue = watchQty * watchPrice

  function handleProductChange(name: string) {
    form.setValue("items.0.product_variant", name, { shouldValidate: true })
    const p = products.find((p) => p.name === name)
    if (p && p.materialCost > 0) {
      form.setValue("items.0.unit_price", Math.round(p.materialCost * 100) / 100)
    }
  }

  function handleOpen() {
    form.reset({
      customer_id: "",
      description: "",
      deadline: "",
      priority: "normal",
      gst_rate: 18,
      notes: "",
      items: [{ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "", thickness_mm: null }],
    })
    setOpen(true)
  }

  function onSubmit(data: OrderFormData, asDraft?: boolean) {
    startTransition(async () => {
      const result = await createOrder({ ...data, status: asDraft ? "draft" : "confirmed" })
      if (result && "error" in result && result.error) { toast.error(result.error); return }
      if (result && "data" in result && result.data) {
        toast.success("Order created")
        setOpen(false)
        router.push(`/orders/${result.data.id}`)
      }
    })
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        New Order
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>New Order</SheetTitle>
            <SheetDescription>Create a new customer production order</SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit((d) => onSubmit(d))} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Customer */}
              <div className="space-y-1.5">
                <Label>Customer *</Label>
                <CustomerSelect
                  value={form.watch("customer_id")}
                  onChange={(v) => form.setValue("customer_id", v, { shouldValidate: true })}
                  customers={customers}
                  placeholder="Select a customer"
                  addLabel="Add New Customer"
                />
                {form.formState.errors.customer_id && (
                  <p className="text-xs text-destructive">{form.formState.errors.customer_id.message}</p>
                )}
              </div>

              {/* Product / BOM */}
              <div className="space-y-1.5">
                <Label>Product *</Label>
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
                  <p className="text-xs text-destructive">{form.formState.errors.items[0]?.product_variant?.message}</p>
                )}
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <Label>Deadline *</Label>
                <Controller
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                  )}
                />
                {form.formState.errors.deadline && (
                  <p className="text-xs text-destructive">{form.formState.errors.deadline.message}</p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label>Quantity (pcs) *</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="Enter quantity"
                  {...form.register("items.0.quantity", { valueAsNumber: true })}
                />
                {form.formState.errors.items?.[0]?.quantity && (
                  <p className="text-xs text-destructive">{form.formState.errors.items[0]?.quantity?.message}</p>
                )}
              </div>

              <Separator />

              {/* Order Value */}
              <div className="rounded-lg bg-muted/40 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Order Value</span>
                <span className="text-xl font-bold tabular-nums">
                  {orderValue > 0 ? `₹${fmt(orderValue)}` : "—"}
                </span>
              </div>

            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" variant="secondary" disabled={isPending}
                onClick={() => form.handleSubmit((d) => onSubmit(d, true))()}>
                {isPending ? "Saving…" : "Save as Draft"}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Confirm Order"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
