"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

import { costingSchema, type CostingFormData } from "@/lib/validators/finance"
import { upsertOrderCosting } from "@/actions/finance"
import type { OrderCosting } from "@/lib/supabase/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

interface CostingFormProps {
  orderId: string
  existing: OrderCosting | null
  computedMaterialCost: number
}

function formatCurrency(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function CostingForm({ orderId, existing, computedMaterialCost }: CostingFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CostingFormData>({
    resolver: zodResolver(costingSchema),
    defaultValues: {
      material_cost: existing?.material_cost ?? computedMaterialCost,
      labor_cost: existing?.labor_cost ?? 0,
      overhead_cost: existing?.overhead_cost ?? 0,
      other_cost: existing?.other_cost ?? 0,
      notes: existing?.notes ?? "",
    },
  })

  const materialCost = watch("material_cost") ?? 0
  const laborCost = watch("labor_cost") ?? 0
  const overheadCost = watch("overhead_cost") ?? 0
  const otherCost = watch("other_cost") ?? 0
  const total = Number(materialCost) + Number(laborCost) + Number(overheadCost) + Number(otherCost)

  async function onSubmit(data: CostingFormData) {
    setLoading(true)
    setError(null)
    setSaved(false)
    const result = await upsertOrderCosting(orderId, data)
    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
          Costing saved successfully.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="material_cost">
            Material Cost (₹)
            {computedMaterialCost > 0 && (
              <span className="ml-1 text-xs text-muted-foreground font-normal">
                (computed: ₹{formatCurrency(computedMaterialCost)})
              </span>
            )}
          </Label>
          <Input
            id="material_cost"
            type="number"
            min="0"
            step="0.01"
            {...register("material_cost", { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.material_cost && (
            <p className="text-xs text-destructive">{errors.material_cost.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="labor_cost">Labor Cost (₹)</Label>
          <Input
            id="labor_cost"
            type="number"
            min="0"
            step="0.01"
            {...register("labor_cost", { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.labor_cost && (
            <p className="text-xs text-destructive">{errors.labor_cost.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="overhead_cost">Overhead Cost (₹)</Label>
          <Input
            id="overhead_cost"
            type="number"
            min="0"
            step="0.01"
            {...register("overhead_cost", { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.overhead_cost && (
            <p className="text-xs text-destructive">{errors.overhead_cost.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="other_cost">Other Cost (₹)</Label>
          <Input
            id="other_cost"
            type="number"
            min="0"
            step="0.01"
            {...register("other_cost", { valueAsNumber: true })}
            placeholder="0.00"
          />
          {errors.other_cost && (
            <p className="text-xs text-destructive">{errors.other_cost.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          {...register("notes")}
          rows={3}
          placeholder="Add notes about cost breakdown…"
        />
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total Cost</p>
          <p className="text-2xl font-bold">₹{formatCurrency(total)}</p>
        </div>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {existing ? "Update Costing" : "Save Costing"}
        </Button>
      </div>
    </form>
  )
}
