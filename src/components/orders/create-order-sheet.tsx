"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

import { orderSchema, type OrderFormData } from "@/lib/validators/order"
import { createOrder } from "@/actions/orders"
import { formatCurrency } from "@/lib/utils"

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

interface Props {
  customers: Array<{ id: string; name: string; company: string | null }>
}

export function CreateOrderSheet({ customers }: Props) {
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
      items: [{ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchItems = form.watch("items")

  const totalQuantity = watchItems?.reduce((s, i) => s + (Number(i.quantity) || 0), 0) ?? 0
  const totalValue = watchItems?.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unit_price) || 0), 0) ?? 0

  function handleOpen() {
    form.reset({
      customer_id: "",
      description: "",
      deadline: "",
      priority: "normal",
      gst_rate: 18,
      notes: "",
      items: [{ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "" }],
    })
    setOpen(true)
  }

  function onSubmit(data: OrderFormData) {
    startTransition(async () => {
      const result = await createOrder(data)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
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
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>New Order</SheetTitle>
            <SheetDescription>Create a new customer production order</SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
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

              {/* Description */}
              <div className="space-y-1.5">
                <Label>Description</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Order description…"
                  {...form.register("description")}
                />
              </div>

              {/* Deadline + Priority */}
              <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Controller
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {/* GST */}
              <div className="space-y-1.5">
                <Label>GST Rate (%)</Label>
                <Controller
                  control={form.control}
                  name="gst_rate"
                  render={({ field }) => (
                    <Select value={String(field.value ?? 18)} onValueChange={(v) => field.onChange(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0% — Exempt</SelectItem>
                        <SelectItem value="5">5%</SelectItem>
                        <SelectItem value="12">12%</SelectItem>
                        <SelectItem value="18">18%</SelectItem>
                        <SelectItem value="28">28%</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <Separator />

              {/* Line items */}
              <div className="space-y-3">
                <p className="text-sm font-semibold">Order Items</p>

                {fields.map((field, index) => (
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

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Product / Variant *</Label>
                        <Input
                          placeholder="e.g., Frypan 28cm"
                          {...form.register(`items.${index}.product_variant`)}
                        />
                        {form.formState.errors.items?.[index]?.product_variant && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.product_variant?.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Size *</Label>
                        <Input
                          placeholder="e.g., 28cm"
                          {...form.register(`items.${index}.size`)}
                        />
                        {form.formState.errors.items?.[index]?.size && (
                          <p className="text-xs text-destructive">{form.formState.errors.items[index]?.size?.message}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3 grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Color / Coating</Label>
                        <Input placeholder="e.g., Black" {...form.register(`items.${index}.color`)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Qty *</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="100"
                          {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Unit Price (₹)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">HSN Code</Label>
                      <Input placeholder="e.g., 7615" {...form.register(`items.${index}.hsn_code`)} />
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => append({ product_variant: "", size: "", color: "", quantity: 1, unit_price: 0, hsn_code: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>

                {(totalQuantity > 0 || totalValue > 0) && (
                  <div className="flex justify-between items-center pt-1 text-sm">
                    <span className="text-muted-foreground">{totalQuantity} pcs</span>
                    <span className="font-semibold">{formatCurrency(totalValue)}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Additional notes…"
                  {...form.register("notes")}
                />
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  form.setValue("status", "draft")
                  form.handleSubmit(onSubmit)()
                }}
                disabled={isPending}
              >
                Save as Draft
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
