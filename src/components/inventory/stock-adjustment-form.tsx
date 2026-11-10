"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { toast } from "sonner"
import {
  stockAdjustmentSchema,
  type StockAdjustmentFormData,
} from "@/lib/validators/inventory"
import { createStockTransaction } from "@/actions/inventory"
import type { Material } from "@/lib/supabase/types"

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

const TRANSACTION_TYPES = [
  { value: "purchase_in", label: "Purchase In (+)" },
  { value: "production_out", label: "Production Out (-)" },
  { value: "adjustment", label: "Adjustment (+)" },
  { value: "return", label: "Return (+)" },
] as const

interface StockAdjustmentFormProps {
  material: Material
}

export function StockAdjustmentForm({ material }: StockAdjustmentFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<StockAdjustmentFormData>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      material_id: material.id,
      type: "purchase_in",
      quantity: 0,
      quantity_kg: material.circle_type ? 0 : undefined,
      notes: "",
    },
  })

  async function onSubmit(data: StockAdjustmentFormData) {
    setIsSubmitting(true)
    setError(null)

    try {
      const result = await createStockTransaction(data)
      if (result && "error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success("Stock adjustment saved")
      router.push(`/inventory/${material.id}`)
      router.refresh()
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
          <CardTitle>Stock Adjustment</CardTitle>
          <CardDescription>
            Adjust stock for <strong>{material.name}</strong> (Current:{" "}
            {material.current_stock} {material.unit})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Type */}
            <div className="space-y-2">
              <Label>Transaction Type</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value) =>
                  form.setValue(
                    "type",
                    value as StockAdjustmentFormData["type"],
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity / pieces */}
            <div className="space-y-2">
              <Label htmlFor="quantity">{material.circle_type ? "Pieces" : `Quantity (${material.unit})`}</Label>
              <Input
                id="quantity"
                type="number"
                min={0.01}
                step={material.circle_type ? "1" : "0.01"}
                {...form.register("quantity", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
              />
              {form.formState.errors.quantity && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>

            {material.circle_type && (
              <div className="space-y-2">
                <Label htmlFor="quantity_kg">Actual weight (kg)</Label>
                <Input
                  id="quantity_kg"
                  type="number"
                  min={0}
                  step="0.001"
                  {...form.register("quantity_kg", { setValueAs: (v) => (v === "" || v == null ? 0 : Number(v)) })}
                />
                {form.formState.errors.quantity_kg && (
                  <p className="text-sm text-destructive">{form.formState.errors.quantity_kg.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Enter the measured kg independently. Pieces and kg do not need to match the calculated utensil weight.
                </p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Reason for adjustment..."
              {...form.register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/inventory/${material.id}`)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Submit Adjustment"}
        </Button>
      </div>
    </form>
  )
}
