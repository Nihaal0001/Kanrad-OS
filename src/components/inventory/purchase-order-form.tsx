"use client"

import { circleLineFromKg, circleWeightFor, isCircleMaterial } from "@/lib/costing"
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
  circle_type?: "ib" | "non_ib" | null
  weight_kg?: number | null
  diameter_mm?: number | null
  thickness_mm?: number | null
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
      payment_terms: 45,
      notes: "Stock-up purchase order — not tied to a specific customer order",
      reference_no: "",
      other_references: "",
      dispatched_through: "",
      destination: "",
      terms_of_delivery: "",
      mode_of_payment: "",
      order_ids: [],
      items: [{ material_id: "", quantity_ordered: 0, unit_price: 0, weight_kg: null, quantity_kg: null, price_per_kg: null, ib_plate_price: null }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchedItems = form.watch("items")

  // Circles are ordered in kg at a price per kg; the line's pieces and price per piece follow from the weight
  function recomputeCircle(index: number) {
    const it = form.getValues(`items.${index}`)
    const m = materialsMap[it.material_id]
    if (!m || !isCircleMaterial(m)) return
    const weight = m.circle_type === "ib" ? it.weight_kg : circleWeightFor(m) ?? it.weight_kg
    const kg = Number(it.quantity_kg) || 0
    const perKg = Number(it.price_per_kg) || 0
    const plate = m.circle_type === "ib" ? Number(it.ib_plate_price) || 0 : 0
    if (weight && weight > 0 && kg > 0) {
      const { pieces, unitPrice } = circleLineFromKg(kg, perKg, weight, plate)
      form.setValue(`items.${index}.quantity_ordered`, pieces, { shouldValidate: true })
      form.setValue(`items.${index}.unit_price`, unitPrice, { shouldValidate: true })
    } else {
      form.setValue(`items.${index}.quantity_ordered`, 0)
      form.setValue(`items.${index}.unit_price`, 0)
    }
  }

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

          <div className="grid gap-4 sm:grid-cols-4">
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
              <Label>Payment Terms (days) *</Label>
              <Input
                type="number"
                min={0}
                max={365}
                step="1"
                placeholder="e.g. 45"
                {...form.register("payment_terms", { valueAsNumber: true })}
              />
              {form.formState.errors.payment_terms ? (
                <p className="text-xs text-destructive">{form.formState.errors.payment_terms.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Bills are due this many days after entry</p>
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
            const circle = !!mat && isCircleMaterial(mat)
            const circleWeight = mat && circle ? (mat.circle_type === "ib" ? item?.weight_kg : circleWeightFor(mat) ?? item?.weight_kg) : null
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
                      form.setValue(`items.${index}.weight_kg`, m?.circle_type === "ib" ? m.weight_kg ?? null : null)
                      if (m && isCircleMaterial(m)) {
                        // Circle: order in kg. Prefill the price per kg from the last average price per piece.
                        const w = m.circle_type === "ib" ? m.weight_kg : circleWeightFor(m)
                        form.setValue(`items.${index}.quantity_kg`, null)
                        form.setValue(`items.${index}.price_per_kg`, m.circle_type !== "ib" && w && m.cost_per_unit > 0 ? Math.round((m.cost_per_unit / w) * 100) / 100 : 0)
                        form.setValue(`items.${index}.ib_plate_price`, m.circle_type === "ib" ? 0 : null)
                        form.setValue(`items.${index}.quantity_ordered`, 0)
                        form.setValue(`items.${index}.unit_price`, 0)
                      } else {
                        form.setValue(`items.${index}.quantity_kg`, null)
                        form.setValue(`items.${index}.price_per_kg`, null)
                        form.setValue(`items.${index}.ib_plate_price`, null)
                      }
                    }}
                  />
                  {mat?.circle_type === "ib" && (
                    <div className="space-y-1 pt-1">
                      <Label className="text-xs">IB circle — weight per piece (kg) *</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.0001"
                        className="h-9"
                        placeholder="e.g. 0.537"
                        {...form.register(`items.${index}.weight_kg`, {
                          setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                          onChange: () => recomputeCircle(index),
                        })}
                      />
                      <Label className="text-xs pt-1 block">IB plate price (₹ per piece)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-9"
                        placeholder="e.g. 25"
                        {...form.register(`items.${index}.ib_plate_price`, {
                          setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                          onChange: () => recomputeCircle(index),
                        })}
                      />
                      <p className="text-xs text-muted-foreground">Enter the weight and IB plate price, then the kg and aluminium price per kg.</p>
                    </div>
                  )}
                  {circle && mat.circle_type !== "ib" && circleWeight ? (
                    <p className="text-xs text-muted-foreground">Weight: {Number(circleWeight).toFixed(4)} kg/pc (auto from size)</p>
                  ) : null}
                  {circle && circleWeight && (item?.quantity_kg ?? 0) > 0 ? (
                    <p className="text-xs font-medium text-emerald-600">
                      = {(item?.quantity_ordered ?? 0).toLocaleString("en-IN")} pcs @ ₹{(item?.unit_price ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}/pc
                      {mat?.circle_type === "ib" && (item?.ib_plate_price ?? 0) > 0 ? ` (incl. ₹${item?.ib_plate_price} IB plate)` : ""} — received in pcs
                    </p>
                  ) : null}
                  {mat?.category_name && (
                    <p className="text-xs text-muted-foreground">Category: {mat.category_name}</p>
                  )}
                  {form.formState.errors.items?.[index]?.material_id && (
                    <p className="text-xs text-destructive">{form.formState.errors.items[index].material_id?.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Quantity {circle ? "(kg)" : mat ? `(${mat.unit})` : ""}</Label>
                  {circle ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9"
                      placeholder="kg"
                      {...form.register(`items.${index}.quantity_kg`, {
                        setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                        onChange: () => recomputeCircle(index),
                      })}
                    />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9"
                      placeholder="0"
                      {...form.register(`items.${index}.quantity_ordered`, { valueAsNumber: true })}
                    />
                  )}
                  {circle && <p className="text-xs text-muted-foreground">ordered in kg</p>}
                </div>

                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">{circle ? "Price / kg" : "Price / Unit"}</Label>
                  {circle ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9"
                      placeholder="₹ per kg"
                      {...form.register(`items.${index}.price_per_kg`, {
                        setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
                        onChange: () => recomputeCircle(index),
                      })}
                    />
                  ) : (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-9"
                      placeholder="0.00"
                      {...form.register(`items.${index}.unit_price`, { valueAsNumber: true })}
                    />
                  )}
                  {circle && <p className="text-xs text-muted-foreground">per kg</p>}
                </div>

                <div className="flex items-center justify-end h-9 text-sm font-medium tabular-nums">
                  {formatCurrency(amount)}
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
            onClick={() => append({ material_id: "", quantity_ordered: 0, unit_price: 0, weight_kg: null, quantity_kg: null, price_per_kg: null, ib_plate_price: null })}
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total (before tax)</p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
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
