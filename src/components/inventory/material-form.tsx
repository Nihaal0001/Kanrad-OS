"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { toast } from "sonner"
import { Lock } from "lucide-react"
import { materialSchema, type MaterialFormData } from "@/lib/validators/inventory"
import { createMaterial, updateMaterial } from "@/actions/inventory"
import type { MaterialWithCategory, MaterialCategory } from "@/lib/supabase/types"

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
import { Controller } from "react-hook-form"

interface MaterialFormProps {
  material?: MaterialWithCategory
  categories: MaterialCategory[]
}

const UNITS = [
  "meters",
  "kg",
  "pcs",
  "rolls",
  "cones",
  "yards",
  "sets",
  "packs",
  "liters",
] as const

export function MaterialForm({ material, categories }: MaterialFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isEditing = !!material

  const form = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      sku: material?.sku ?? "",
      name: material?.name ?? "",
      category_id: material?.category_id ?? "",
      unit: material?.unit ?? "meters",
      min_stock_level: material?.min_stock_level ?? 0,
      cost_per_unit: material?.cost_per_unit ?? 0,
      supplier_name: material?.supplier_name ?? "",
      supplier_contact: material?.supplier_contact ?? "",
      location: material?.location ?? "",
      notes: material?.notes ?? "",
      is_circle: !!material?.circle_type || !!(material?.diameter_mm),
      diameter_mm: material?.diameter_mm ?? null,
      thickness_mm: material?.thickness_mm ?? null,
      circle_type: material?.circle_type ?? null,
    },
  })

  const isCircle = form.watch("is_circle")

  function handleCircleToggle(checked: boolean) {
    form.setValue("is_circle", checked)
    if (checked) form.setValue("unit", "kg")
  }

  async function onSubmit(data: MaterialFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditing) {
        const result = await updateMaterial(material.id, data)
        if (result && "error" in result && result.error) {
          setError(result.error)
          toast.error(result.error)
          return
        }
        toast.success("Material updated")
        router.push(`/inventory/${material.id}`)
      } else {
        const result = await createMaterial(data)
        if (result && "error" in result && result.error) {
          setError(result.error)
          toast.error(result.error)
          return
        }
        if (result && "data" in result && result.data) {
          toast.success("Material created")
          router.push(`/inventory/${result.data.id}`)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Material Details</CardTitle>
          <CardDescription>
            Basic information about the material
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* SKU */}
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder="e.g., FAB-COT-WHT-001"
                {...form.register("sku")}
              />
              {form.formState.errors.sku && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.sku.message}
                </p>
              )}
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., Alu Circle 263 x 3mm"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.watch("category_id") || ""}
                onValueChange={(value) =>
                  form.setValue("category_id", value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unit */}
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select
                value={form.watch("unit")}
                onValueChange={(value) =>
                  form.setValue("unit", value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cost per unit — price ceiling */}
            <div className="space-y-2">
              <Label htmlFor="cost_per_unit" className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                Max Purchase Price (₹)
              </Label>
              <Input
                id="cost_per_unit"
                type="number"
                min={0}
                step="0.01"
                {...form.register("cost_per_unit", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Purchase Orders cannot exceed this price per unit.
              </p>
              {form.formState.errors.cost_per_unit && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.cost_per_unit.message}
                </p>
              )}
            </div>
          </div>

          {/* Min stock level */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="min_stock_level">Minimum Stock Level</Label>
              <Input
                id="min_stock_level"
                type="number"
                min={0}
                step="0.01"
                {...form.register("min_stock_level", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">
                Alert will show when stock falls below this level
              </p>
              {form.formState.errors.min_stock_level && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.min_stock_level.message}
                </p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Storage Location</Label>
              <Input
                id="location"
                placeholder="e.g., Rack A3, Shelf 2"
                {...form.register("location")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supplier Info */}
      <Card>
        <CardHeader>
          <CardTitle>Supplier Information</CardTitle>
          <CardDescription>
            Primary supplier details for this material
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier_name">Supplier Name</Label>
              <Input
                id="supplier_name"
                placeholder="Supplier name"
                {...form.register("supplier_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier_contact">Supplier Contact</Label>
              <Input
                id="supplier_contact"
                placeholder="Phone or email"
                {...form.register("supplier_contact")}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aluminium Circle */}
      <Card>
        <CardHeader>
          <CardTitle>Aluminium Circle</CardTitle>
          <CardDescription>
            Fill this section only for aluminium circle stock items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={!!isCircle}
              onChange={(e) => handleCircleToggle(e.target.checked)}
            />
            <span className="text-sm font-medium">This material is an aluminium circle</span>
          </label>

          {isCircle && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="diameter_mm">Diameter (mm)</Label>
                <Input
                  id="diameter_mm"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g., 240"
                  {...form.register("diameter_mm", { valueAsNumber: true, setValueAs: (v) => (v === "" || isNaN(v) ? null : Number(v)) })}
                />
                {form.formState.errors.diameter_mm && (
                  <p className="text-sm text-destructive">{form.formState.errors.diameter_mm.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="thickness_mm">Thickness (mm)</Label>
                <Input
                  id="thickness_mm"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g., 3"
                  {...form.register("thickness_mm", { valueAsNumber: true, setValueAs: (v) => (v === "" || isNaN(v) ? null : Number(v)) })}
                />
                {form.formState.errors.thickness_mm && (
                  <p className="text-sm text-destructive">{form.formState.errors.thickness_mm.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Controller
                  control={form.control}
                  name="circle_type"
                  render={({ field }) => (
                    <Select value={field.value ?? ""} onValueChange={(v) => field.onChange(v || null)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="non_ib">Non-IB</SelectItem>
                        <SelectItem value="ib">IB</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            id="notes"
            className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Any additional notes about this material..."
            {...form.register("notes")}
          />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/inventory")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? "Saving..."
            : isEditing
            ? "Update Material"
            : "Create Material"}
        </Button>
      </div>
    </form>
  )
}
