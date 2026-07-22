"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2, Loader2, Calculator, Check } from "lucide-react"
import { toast } from "sonner"

import { bomSchema, type BomFormData } from "@/lib/validators/bom"
import { createProduct, updateProduct } from "@/actions/bom"
import type { BomDetail, Material } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

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

type MaterialOption = Pick<Material, "id" | "name" | "sku" | "cost_per_unit" | "unit" | "current_stock"> & {
  category_id?: string | null
  category_name?: string | null
}

interface BomFormProps {
  product?: BomDetail
  materials: MaterialOption[]
}

const CATEGORIES = [
  "Cookware",
  "Kitchenware",
  "Pressure Cooker",
  "Non-Stick",
  "Hard Anodized",
  "Stainless Steel",
  "Aluminium",
  "Other",
] as const

const UNITS = ["kg", "meters", "pcs", "rolls", "liters", "sets", "packs"] as const

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ── Combobox ────────────────────────────────────────────────────────────────
interface MaterialComboboxProps {
  materials: MaterialOption[]
  value: string
  categoryFilter: string
  onChange: (id: string, unit: string) => void
}

function MaterialCombobox({ materials, value, categoryFilter, onChange }: MaterialComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = materials.find((m) => m.id === value)

  const filtered = materials.filter((m) => {
    if (categoryFilter && m.category_id !== categoryFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.sku.toLowerCase().includes(q)
  })

  // Close on outside click
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
                  onChange(m.id, m.unit)
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
                    ₹{m.cost_per_unit}/{m.unit}
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

// ── BomForm ─────────────────────────────────────────────────────────────────
export function BomForm({ product, materials }: BomFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const isEditing = !!product

  // Per-row category filter
  const [rowCategories, setRowCategories] = useState<Record<number, string>>({})

  // Unique categories extracted from materials
  const categories = Array.from(
    new Map(
      materials
        .filter((m) => m.category_id && m.category_name)
        .map((m) => [m.category_id!, m.category_name!])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const form = useForm<BomFormData>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      product_sku: product?.product_sku ?? "",
      product_name: product?.product_name ?? "",
      brand: product?.brand ?? "",
      category: product?.category ?? "",
      notes: product?.notes ?? "",
      items: product?.bom_items?.map((item) => ({
        material_id: item.material_id,
        qty_required: item.qty_required,
        unit: item.unit,
        wastage_pct: item.wastage_pct,
        notes: item.notes ?? "",
      })) ?? [{ material_id: "", qty_required: 0, unit: "kg", wastage_pct: 0, notes: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const watchedItems = form.watch("items")

  const materialsMap = Object.fromEntries(materials.map((m) => [m.id, m]))
  const totalBomCost = watchedItems.reduce((sum, item) => {
    const mat = materialsMap[item.material_id]
    if (!mat) return sum
    const effectiveQty = (item.qty_required || 0) * (1 + (item.wastage_pct || 0) / 100)
    return sum + effectiveQty * mat.cost_per_unit
  }, 0)

  async function onSubmit(data: BomFormData) {
    setLoading(true)
    try {
      if (isEditing) {
        const result = await updateProduct(product.id, data)
        if (result && "error" in result && result.error) {
          toast.error(result.error)
          return
        }
        toast.success("Product updated")
        router.push(`/products/${product.id}`)
      } else {
        const result = await createProduct(data)
        if (result && "error" in result && result.error) {
          toast.error(result.error)
          return
        }
        if (result && "data" in result && result.data) {
          toast.success("Product created")
          router.push(`/products/${result.data.id}`)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Product Info */}
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>
            Define the product — the BOM below lists all materials needed to produce one unit
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="product_sku">Product SKU</Label>
              <Input
                id="product_sku"
                placeholder="e.g., KD-240-NS"
                {...form.register("product_sku")}
              />
              {form.formState.errors.product_sku && (
                <p className="text-sm text-destructive">{form.formState.errors.product_sku.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name</Label>
              <Input
                id="product_name"
                placeholder="e.g., Kadai 240mm Non-Stick"
                {...form.register("product_name")}
              />
              {form.formState.errors.product_name && (
                <p className="text-sm text-destructive">{form.formState.errors.product_name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                placeholder="e.g., Deepam"
                {...form.register("brand")}
              />
              {form.formState.errors.brand && (
                <p className="text-sm text-destructive">{form.formState.errors.brand.message}</p>
              )}
            </div>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Product notes..."
              {...form.register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      {/* BOM Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Bill of Materials
          </CardTitle>
          <CardDescription>
            Materials required to produce one unit of this product. Wastage % accounts for material loss during production.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-[2fr_1fr_0.8fr_0.8fr_1fr_40px] gap-3 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
            <span>Material</span>
            <span>Qty Required</span>
            <span>Unit</span>
            <span>Wastage %</span>
            <span className="text-right">Line Cost</span>
            <span />
          </div>

          {fields.map((field, index) => {
            const item = watchedItems[index]
            const mat = item ? materialsMap[item.material_id] : null
            const effectiveQty = (item?.qty_required || 0) * (1 + (item?.wastage_pct || 0) / 100)
            const lineCost = mat ? effectiveQty * mat.cost_per_unit : 0
            const categoryFilter = rowCategories[index] ?? ""

            return (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_0.8fr_0.8fr_1fr_40px] gap-3 items-start rounded-lg border p-3 sm:border-0 sm:p-0"
              >
                {/* Material picker: category filter + combobox */}
                <div className="space-y-1.5">
                  <Label className="sm:hidden text-xs">Material</Label>
                  {/* Category filter */}
                  <Select
                    value={categoryFilter || "__all__"}
                    onValueChange={(v) =>
                      setRowCategories((prev) => ({ ...prev, [index]: v === "__all__" ? "" : v }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs text-muted-foreground">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All categories</SelectItem>
                      {categories.map(([catId, catName]) => (
                        <SelectItem key={catId} value={catId}>{catName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Combobox */}
                  <MaterialCombobox
                    materials={materials}
                    value={item?.material_id || ""}
                    categoryFilter={categoryFilter}
                    onChange={(id, unit) => {
                      form.setValue(`items.${index}.material_id`, id, { shouldValidate: true })
                      form.setValue(`items.${index}.unit`, unit)
                    }}
                  />
                  {form.formState.errors.items?.[index]?.material_id && (
                    <p className="text-xs text-destructive">{form.formState.errors.items[index].material_id?.message}</p>
                  )}
                </div>

                {/* Qty */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Qty Required</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.0001"
                    className="h-9"
                    placeholder="0"
                    {...form.register(`items.${index}.qty_required`, { valueAsNumber: true })}
                  />
                </div>

                {/* Unit */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Unit</Label>
                  <Select
                    value={item?.unit || "kg"}
                    onValueChange={(v) => form.setValue(`items.${index}.unit`, v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Wastage */}
                <div className="space-y-1">
                  <Label className="sm:hidden text-xs">Wastage %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    className="h-9"
                    placeholder="0"
                    {...form.register(`items.${index}.wastage_pct`, { valueAsNumber: true })}
                  />
                </div>

                {/* Line cost */}
                <div className="flex items-center justify-end h-9 text-sm font-medium tabular-nums">
                  ₹{formatCurrency(lineCost)}
                </div>

                {/* Remove */}
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
            onClick={() => append({ material_id: "", qty_required: 0, unit: "kg", wastage_pct: 0, notes: "" })}
          >
            <Plus className="h-4 w-4" />
            Add Material
          </Button>

          <Separator />

          {/* Total BOM cost */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total BOM Cost (per unit)</p>
              <p className="text-2xl font-bold tabular-nums">₹{formatCurrency(totalBomCost)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Saving..." : isEditing ? "Update Product" : "Create Product"}
        </Button>
      </div>
    </form>
  )
}
