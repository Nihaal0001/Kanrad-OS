"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { toast } from "sonner"
import {
  qualityCheckSchema,
  type QualityCheckFormData,
} from "@/lib/validators/production"
import { createQualityCheck } from "@/actions/production"
import type { ProductionStage } from "@/lib/supabase/types"

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

const DEFECT_TYPES = [
  "Stitching",
  "Measurement",
  "Fabric",
  "Finishing",
  "Label",
  "Colour",
  "Other",
]

interface QualityCheckFormProps {
  orderId: string
  orderNumber: string
  stages: ProductionStage[]
}

export function QualityCheckForm({
  orderId,
  orderNumber,
  stages,
}: QualityCheckFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<QualityCheckFormData>({
    resolver: zodResolver(qualityCheckSchema),
    defaultValues: {
      order_id: orderId,
      stage_id: "",
      quantity_inspected: 0,
      quantity_passed: 0,
      quantity_failed: 0,
      defect_type: "",
      severity: undefined,
      notes: "",
      checked_at: new Date().toISOString().split("T")[0],
    },
  })

  const watchInspected = form.watch("quantity_inspected")
  const watchPassed = form.watch("quantity_passed")
  const watchFailed = form.watch("quantity_failed")
  const passRate =
    watchInspected > 0
      ? Math.round((watchPassed / watchInspected) * 100)
      : null

  async function onSubmit(data: QualityCheckFormData) {
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createQualityCheck(data)
      if (result && "error" in result && result.error) {
        setError(result.error)
        toast.error(result.error)
        return
      }
      toast.success("QC inspection saved")
      router.push(`/production/${orderId}`)
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
          <CardTitle>Inspection Details</CardTitle>
          <CardDescription>Order {orderNumber}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Stage</Label>
              <Select
                value={form.watch("stage_id") || ""}
                onValueChange={(v) =>
                  form.setValue("stage_id", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.sequence}. {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checked_at">Inspection Date</Label>
              <Input
                id="checked_at"
                type="date"
                {...form.register("checked_at")}
              />
              {form.formState.errors.checked_at && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.checked_at.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="quantity_inspected">Qty Inspected</Label>
              <Input
                id="quantity_inspected"
                type="number"
                min={1}
                {...form.register("quantity_inspected", {
                  valueAsNumber: true,
                })}
              />
              {form.formState.errors.quantity_inspected && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.quantity_inspected.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_passed">Qty Passed</Label>
              <Input
                id="quantity_passed"
                type="number"
                min={0}
                {...form.register("quantity_passed", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity_failed">Qty Failed</Label>
              <Input
                id="quantity_failed"
                type="number"
                min={0}
                {...form.register("quantity_failed", { valueAsNumber: true })}
              />
            </div>
          </div>

          {passRate !== null && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                passRate >= 95
                  ? "bg-emerald-50 text-emerald-700"
                  : passRate >= 80
                  ? "bg-amber-50 text-amber-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              Pass rate: {passRate}% ({watchPassed} passed, {watchFailed}{" "}
              failed of {watchInspected} inspected)
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Defect Details</CardTitle>
          <CardDescription>Only fill if there are failures</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Defect Type</Label>
              <Select
                value={form.watch("defect_type") || ""}
                onValueChange={(v) =>
                  form.setValue("defect_type", v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select defect type" />
                </SelectTrigger>
                <SelectContent>
                  {DEFECT_TYPES.map((d) => (
                    <SelectItem key={d} value={d.toLowerCase()}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={form.watch("severity") || ""}
                onValueChange={(v) =>
                  form.setValue(
                    "severity",
                    v as QualityCheckFormData["severity"],
                    { shouldValidate: true }
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Additional notes about this inspection..."
              {...form.register("notes")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/production/${orderId}`)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Submit Inspection"}
        </Button>
      </div>
    </form>
  )
}
