"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { bomSchema, type BomFormData } from "@/lib/validators/bom"
import { createProduct } from "@/actions/bom"
import type { Material } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

type MaterialOption = Pick<Material, "id" | "name" | "sku" | "cost_per_unit" | "unit">

interface Props {
  materials: MaterialOption[]
}

const CATEGORIES = [
  "Cookware", "Kitchenware", "Pressure Cooker",
  "Non-Stick", "Hard Anodized", "Stainless Steel", "Aluminium", "Other",
] as const

const UNITS = ["kg", "meters", "pcs", "rolls", "liters", "sets", "packs"] as const

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CreateProductSheet({ materials }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<BomFormData>({
    resolver: zodResolver(bomSchema),
    defaultValues: {
      product_sku: "",
      product_name: "",
      category: "",
      notes: "",
      items: [{ material_id: "", qty_required: 0, unit: "kg", wastage_pct: 0, notes: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const watchedItems = form.watch("items")

  const materialsMap = Object.fromEntries(materials.map((m) => [m.id, m]))

  const totalBomCost = watchedItems.reduce((sum, item) => {
    const mat = materialsMap[item.material_id]
    if (!mat) return sum
    const effectiveQty = (item.qty_required || 0) * (1 + (item.wastage_pct || 0) / 100)
    return sum + effectiveQty * mat.cost_per_unit
  }, 0)

  function handleOpen() {
    form.reset({
      product_sku: "",
      product_name: "",
      category: "",
      notes: "",
      items: [{ material_id: "", qty_required: 0, unit: "kg", wastage_pct: 0, notes: "" }],
    })
    setOpen(true)
  }

  function onSubmit(data: BomFormData) {
    startTransition(async () => {
      const result = await createProduct(data)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Product created")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        New Product
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>New Product (BOM)</SheetTitle>
            <SheetDescription>Define a product and the materials needed to make it</SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Product details */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Product Name *</Label>
                  <Input placeholder="e.g., Kadai 240mm Non-Stick" {...form.register("product_name")} />
                  {form.formState.errors.product_name && (
                    <p className="text-xs text-destructive">{form.formState.errors.product_name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>SKU *</Label>
                  <Input placeholder="e.g., KD-240-NS" {...form.register("product_sku")} />
                  {form.formState.errors.product_sku && (
                    <p className="text-xs text-destructive">{form.formState.errors.product_sku.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.watch("category") || ""}
                  onValueChange={(v) => form.setValue("category", v)}
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

              <Separator />

              {/* BOM Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Bill of Materials</p>
                  <p className="text-xs text-muted-foreground">Materials per unit produced</p>
                </div>

                {fields.map((field, index) => {
                  const item = watchedItems[index]
                  const mat = item ? materialsMap[item.material_id] : null
                  const effectiveQty = (item?.qty_required || 0) * (1 + (item?.wastage_pct || 0) / 100)
                  const lineCost = mat ? effectiveQty * mat.cost_per_unit : 0

                  return (
                    <div key={field.id} className="rounded-lg border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Material {index + 1}</p>
                        <div className="flex items-center gap-2">
                          {mat && lineCost > 0 && (
                            <span className="text-xs font-semibold tabular-nums text-emerald-600">
                              ₹{formatCurrency(lineCost)}/unit
                            </span>
                          )}
                          {fields.length > 1 && (
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Material *</Label>
                        <Select
                          value={item?.material_id || ""}
                          onValueChange={(v) => {
                            form.setValue(`items.${index}.material_id`, v, { shouldValidate: true })
                            const m = materialsMap[v]
                            if (m) form.setValue(`items.${index}.unit`, m.unit)
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a material from inventory" />
                          </SelectTrigger>
                          <SelectContent>
                            {materials.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                <span className="font-mono text-xs mr-2">{m.sku}</span>
                                {m.name}
                                {m.cost_per_unit > 0 && (
                                  <span className="ml-2 text-xs text-muted-foreground">
                                    ₹{m.cost_per_unit}/{m.unit}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form.formState.errors.items?.[index]?.material_id && (
                          <p className="text-xs text-destructive">
                            {form.formState.errors.items[index]?.material_id?.message}
                          </p>
                        )}
                      </div>

                      <div className="grid gap-3 grid-cols-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Qty / Unit</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.0001"
                            placeholder="0"
                            {...form.register(`items.${index}.qty_required`, { valueAsNumber: true })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Unit</Label>
                          <Select
                            value={item?.unit || "kg"}
                            onValueChange={(v) => form.setValue(`items.${index}.unit`, v)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {UNITS.map((u) => (
                                <SelectItem key={u} value={u}>{u}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Wastage %</Label>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            placeholder="0"
                            {...form.register(`items.${index}.wastage_pct`, { valueAsNumber: true })}
                          />
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
                  onClick={() => append({ material_id: "", qty_required: 0, unit: "kg", wastage_pct: 0, notes: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Material
                </Button>

                {totalBomCost > 0 && (
                  <div className="flex justify-between items-center pt-1 text-sm font-semibold">
                    <span className="text-muted-foreground">Total BOM Cost / Unit</span>
                    <span className="tabular-nums">₹{formatCurrency(totalBomCost)}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Product notes…"
                  {...form.register("notes")}
                />
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Product"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
