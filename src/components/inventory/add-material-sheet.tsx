"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus, Lock, Circle } from "lucide-react"
import { toast } from "sonner"

import { materialSchema, type MaterialFormData } from "@/lib/validators/inventory"
import { createMaterial } from "@/actions/inventory"
import type { MaterialCategory } from "@/lib/supabase/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

interface Props {
  categories: MaterialCategory[]
}

const UNITS = ["kg", "pcs", "meters", "rolls", "cones", "yards", "sets", "packs", "liters"] as const

export function AddMaterialSheet({ categories }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const form = useForm<MaterialFormData>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      sku: "",
      name: "",
      category_id: "",
      unit: "pcs",
      min_stock_level: 0,
      cost_per_unit: 0,
      supplier_name: "",
      supplier_contact: "",
      location: "",
      notes: "",
      is_circle: false,
      diameter_mm: null,
      thickness_mm: null,
      circle_type: null,
    },
  })

  const isCircle = form.watch("is_circle")

  function handleOpen() {
    form.reset()
    setOpen(true)
  }

  function onSubmit(data: MaterialFormData) {
    startTransition(async () => {
      const result = await createMaterial(data)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Material added")
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <Button onClick={handleOpen}>
        <Plus className="h-4 w-4" />
        Add Material
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle>Add Material</SheetTitle>
            <SheetDescription>Add a new material to the item catalog</SheetDescription>
          </SheetHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input placeholder="e.g., Alu Circle 263 x 3mm" {...form.register("name")} />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>SKU *</Label>
                  <Input placeholder="e.g., ALU-263-3MM" {...form.register("sku")} />
                  {form.formState.errors.sku && (
                    <p className="text-xs text-destructive">{form.formState.errors.sku.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Controller
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit *</Label>
                  <Controller
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u} value={u}>{u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Max Purchase Price (₹)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    {...form.register("cost_per_unit", { valueAsNumber: true })}
                  />
                  <p className="text-xs text-muted-foreground">POs cannot exceed this price</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Min Stock Level</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    {...form.register("min_stock_level", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Supplier Name</Label>
                  <Input placeholder="Supplier name" {...form.register("supplier_name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>Supplier Contact</Label>
                  <Input placeholder="Phone or email" {...form.register("supplier_contact")} />
                </div>
              </div>

              {/* Circle toggle */}
              <div className="rounded-lg border px-4 py-3 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-primary"
                    {...form.register("is_circle")}
                  />
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                    This is an aluminium circle
                  </span>
                </label>

                {isCircle && (
                  <div className="grid gap-3 sm:grid-cols-3 pt-1">
                    <div className="space-y-1.5">
                      <Label>Diameter (mm)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g., 240"
                        {...form.register("diameter_mm", { valueAsNumber: true, setValueAs: (v) => (v === "" || isNaN(v) ? null : Number(v)) })}
                      />
                      {form.formState.errors.diameter_mm && (
                        <p className="text-xs text-destructive">{form.formState.errors.diameter_mm.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>Thickness (mm)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="e.g., 3"
                        {...form.register("thickness_mm", { valueAsNumber: true, setValueAs: (v) => (v === "" || isNaN(v) ? null : Number(v)) })}
                      />
                      {form.formState.errors.thickness_mm && (
                        <p className="text-xs text-destructive">{form.formState.errors.thickness_mm.message}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
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
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                  placeholder="Any notes about this material…"
                  {...form.register("notes")}
                />
              </div>
            </div>

            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving…" : "Add Material"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
