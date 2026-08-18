"use client"

import { useRef, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2, Check, ShoppingCart } from "lucide-react"
import { toast } from "sonner"

import { purchaseOrderSchema, type PurchaseOrderFormData } from "@/lib/validators/inventory"
import { createPurchaseOrder } from "@/actions/inventory"
import { formatCurrency, friendlyError, cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Separator } from "@/components/ui/separator"
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

export interface POMaterialOption {
  id: string
  name: string
  sku: string
  unit: string
  cost_per_unit: number
  category_name?: string | null
}

export interface POSupplierOption {
  id: string
  name: string
  company: string | null
}

interface PurchaseOrderFormProps {
  materials: POMaterialOption[]
  suppliers: POSupplierOption[]
}

// ── Material combobox ───────────────────────────────────────────────────────
interface MaterialComboboxProps {
  materials: POMaterialOption[]
  value: string
  onChange: (id: string) => void
}

function MaterialCombobox({ materials, value, onChange }: MaterialComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = materials.find((m) => m.id === value)

  const filtered = materials.filter((m) => {
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)
  })

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setFocused(false)
        setQuery("")
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const displayValue = focused ? query : (selected ? `${selected.sku} — ${selected.name}` : "")

  return (
    <div ref={containerRef} className="relative">
      <Input
        className="h-9 text-sm"
        placeholder="Search by name or SKU…"
        value={displayValue}
        onFocus={() => {
          setFocused(true)
          setQuery("")
          setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-md border bg-popover shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">No materials found</div>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                className={cn(
                  "w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground flex items-start gap-2",
                  m.id === value && "bg-accent/40"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m.id)
                  setOpen(false)
                  setFocused(false)
                  setQuery("")
                }}
              >
                {m.id === value ? (
                  <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="flex flex-col min-w-0">
                  <span className="truncate">
                    <span className="font-mono text-xs text-muted-foreground mr-1.5">{m.sku}</span>
                    {m.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Last cost ₹{m.cost_per_unit}/{m.unit}
                    {m.category_name && <span className="ml-2">· {m.category_name}</span>}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── PurchaseOrderForm ────────────────────────────────────────────────────────
export function PurchaseOrderForm({ materials, suppliers }: PurchaseOrderFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const materialsMap = Object.fromEntries(materials.map((m) => [m.id, m]))

  const form = useForm<PurchaseOrderFormData>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplier_id: "",
      order_date: new Date().toISOString().slice(0, 10),
      expected_date: "",
      tax_rate: 0,
      notes: "Stock-up purchase order — not tied to a specific customer order",
      reference_no: "",
      other_references: "",
      dispatched_through: "",
      destination: "",
      terms_of_delivery: "",
      mode_of_payment: "",
      order_ids: [],
      items: [{ material_id: "", quantity_ordered: 0, unit_price: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchedItems = form.watch("items")

  const totalAmount = watchedItems.reduce((sum, item) => sum + (item.quantity_ordered || 0) * (item.unit_price || 0), 0)

  async function onSubmit(data: PurchaseOrderFormData) {
    setLoading(true)
    try {
      const result = await createPurchaseOrder(data)
      if (result && "error" in result && result.error) {
        toast.error(friendlyError(result.error))
        return
      }
      if (result && "data" in result && result.data) {
        toast.success("Purchase order raised")
        router.push(`/inventory/purchase-orders/${result.data.id}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Order Details</CardTitle>
          <CardDescription>
            Stock up on materials ahead of season — this purchase order isn&apos;t tied to a specific customer order
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select
                value={form.watch("supplier_id")}
                onValueChange={(v) => form.setValue("supplier_id", v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.company ? ` (${s.company})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.supplier_id && (
                <p className="text-xs text-destructive">{form.formState.errors.supplier_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Order Date</Label>
              <DatePicker
                value={form.watch("order_date")}
                onChange={(v) => form.setValue("order_date", v, { shouldValidate: true })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expected Delivery</Label>
              <DatePicker
                value={form.watch("expected_date")}
                onChange={(v) => form.setValue("expected_date", v)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tax % *</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                placeholder="e.g. 18"
                {...form.register("tax_rate", { valueAsNumber: true })}
              />
              {form.formState.errors.tax_rate && (
                <p className="text-xs text-destructive">{form.formState.errors.tax_rate.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Reference No.</Label>
              <Input placeholder="Defaults to voucher no." {...form.register("reference_no")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Mode/Terms of Payment</Label>
              <Input {...form.register("mode_of_payment")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Dispatched Through</Label>
              <Input {...form.register("dispatched_through")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Destination</Label>
              <Input {...form.register("destination")} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">Terms of Delivery</Label>
              <Input {...form.register("terms_of_delivery")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground">Notes</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...form.register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Items
          </CardTitle>
          <CardDescription>Materials to stock up on and the quantities to order</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_40px] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            <span>Material</span>
            <span>Quantity</span>
            <span>Price / Unit</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          {fields.map((field, index) => {
            const item = watchedItems[index]
            const mat = item ? materialsMap[item.material_id] : null
            const amount = (item?.quantity_ordered || 0) * (item?.unit_price || 0)

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr_1fr_40px] gap-3 items-start rounded-lg border p-3 sm:border-0 sm:p-0"
              >
                <div className="space-y-1.5">
                  <Label className="sm:hidden text-xs">Material</Label>
                  <MaterialCombobox
                    materials={materials}
                    value={item?.material_id || ""}
                    onChange={(id) => {
                      const m = materialsMap[id]
                      form.setValue(`items.${index}.material_id`, id, { shouldValidate: true })
                      if (m) form.setValue(`items.${index}.unit_price`, m.cost_per_unit)
                    }}
                  />
                  {mat?.category_name && (
                    <p className="text-xs text-muted-foreground">Category: {mat.category_name}</p>
                  )}
                  {form.formState.errors.items?.[index]?.material_id && (
                    <p className="text-xs text-destructive">{form.formState.errors.items[index].material_id?.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Quantity {mat ? `(${mat.unit})` : ""}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-9"
                    placeholder="0"
                    {...form.register(`items.${index}.quantity_ordered`, { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Price / Unit</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-9"
                    placeholder="0.00"
                    {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                  />
                </div>

                <div className="flex items-center justify-end h-9 text-sm font-medium tabular-nums">
                  ₹{formatCurrency(amount)}
                </div>

                <div className="flex items-center justify-center h-9">
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {form.formState.errors.items?.root && (
            <p className="text-sm text-destructive">{form.formState.errors.items.root.message}</p>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ material_id: "", quantity_ordered: 0, unit_price: 0 })}
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total (before tax)</p>
              <p className="text-2xl font-bold tabular-nums">₹{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inventory/purchase-orders")}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Raising…" : "Raise Purchase Order"}
        </Button>
      </div>
    </form>
  )
}
