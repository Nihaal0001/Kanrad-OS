"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { CheckCircle2, Clock, AlertCircle, Ban } from "lucide-react"

import { stageUpdateSchema, type StageUpdateFormData } from "@/lib/validators/production"
import { updateProductionStage } from "@/actions/production"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", icon: Clock, color: "text-muted-foreground" },
  { value: "in_progress", label: "In Progress", icon: Clock, color: "text-amber-600" },
  { value: "completed", label: "Completed", icon: CheckCircle2, color: "text-emerald-600" },
  { value: "blocked", label: "Blocked", icon: Ban, color: "text-red-500" },
] as const

interface ProductionLogFormProps {
  trackingId: string
  orderId: string
  stageName: string
  stageSequence: number
  currentStatus: string
  currentQtyCompleted: number
  currentQtyRejected: number
  currentNotes: string | null
  totalQuantity: number
}

export function ProductionLogForm({
  trackingId,
  orderId,
  stageName,
  stageSequence,
  currentStatus,
  currentQtyCompleted,
  currentQtyRejected,
  currentNotes,
  totalQuantity,
}: ProductionLogFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<StageUpdateFormData>({
    resolver: zodResolver(stageUpdateSchema),
    defaultValues: {
      status: currentStatus as StageUpdateFormData["status"],
      quantity_completed: currentQtyCompleted,
      quantity_rejected: currentQtyRejected,
      notes: currentNotes ?? "",
    },
  })

  const watchCompleted = form.watch("quantity_completed") ?? 0
  const watchRejected = form.watch("quantity_rejected") ?? 0
  const remaining = Math.max(0, totalQuantity - Number(watchCompleted))
  const goodPieces = Math.max(0, Number(watchCompleted) - Number(watchRejected))

  async function onSubmit(data: StageUpdateFormData) {
    setIsSubmitting(true)
    try {
      const result = await updateProductionStage(trackingId, orderId, data)
      if (result && "error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`${stageName} updated`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
            {stageSequence}
          </span>
          {stageName}
          <AlertCircle className="ml-auto h-4 w-4 text-primary" />
          <span className="text-sm font-normal text-primary">Active Stage</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Live stats */}
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-background/70 p-3 text-center text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Total Order</p>
              <p className="text-lg font-bold tabular-nums">{totalQuantity}</p>
              <p className="text-xs text-muted-foreground">pcs</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={cn("text-lg font-bold tabular-nums", remaining > 0 ? "text-amber-600" : "text-emerald-600")}>
                {remaining}
              </p>
              <p className="text-xs text-muted-foreground">pcs</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Good Pieces</p>
              <p className="text-lg font-bold tabular-nums text-emerald-600">{goodPieces}</p>
              <p className="text-xs text-muted-foreground">pcs</p>
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Stage Status</Label>
            <Select
              value={form.watch("status")}
              onValueChange={(v) =>
                form.setValue("status", v as StageUpdateFormData["status"], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <Icon className={cn("h-3.5 w-3.5", opt.color)} />
                        {opt.label}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Qty inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`completed-${trackingId}`}>
                Qty Completed
                <span className="ml-1 text-xs text-muted-foreground">(out of {totalQuantity})</span>
              </Label>
              <Input
                id={`completed-${trackingId}`}
                type="number"
                min={0}
                max={totalQuantity}
                placeholder="0"
                {...form.register("quantity_completed", { valueAsNumber: true })}
              />
              {form.formState.errors.quantity_completed && (
                <p className="text-xs text-destructive">{form.formState.errors.quantity_completed.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`rejected-${trackingId}`}>Qty Rejected / Defects</Label>
              <Input
                id={`rejected-${trackingId}`}
                type="number"
                min={0}
                placeholder="0"
                {...form.register("quantity_rejected", { valueAsNumber: true })}
              />
              {form.formState.errors.quantity_rejected && (
                <p className="text-xs text-destructive">{form.formState.errors.quantity_rejected.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${trackingId}`}>Notes / Remarks</Label>
            <textarea
              id={`notes-${trackingId}`}
              className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Machine breakdown, operator absent, material delay..."
              {...form.register("notes")}
            />
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : "Save Production Update"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
