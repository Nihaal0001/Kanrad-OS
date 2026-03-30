"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ChevronDown, ChevronUp } from "lucide-react"

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

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "blocked", label: "Blocked" },
] as const

interface StageInlineFormProps {
  trackingId: string
  orderId: string
  stageName: string
  currentStatus: string
  currentQtyCompleted: number
  currentQtyRejected: number
  currentQtyInput?: number
  currentWasteNotes?: string | null
  currentNotes: string | null
  totalQuantity: number
  collapsed?: boolean
}

export function StageInlineForm({
  trackingId,
  orderId,
  stageName,
  currentStatus,
  currentQtyCompleted,
  currentQtyRejected,
  currentQtyInput,
  currentWasteNotes,
  currentNotes,
  totalQuantity,
  collapsed = false,
}: StageInlineFormProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(!collapsed)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<StageUpdateFormData>({
    resolver: zodResolver(stageUpdateSchema),
    defaultValues: {
      status: currentStatus as StageUpdateFormData["status"],
      quantity_completed: currentQtyCompleted,
      quantity_rejected: currentQtyRejected,
      quantity_input: currentQtyInput ?? 0,
      waste_notes: currentWasteNotes ?? "",
      notes: currentNotes ?? "",
    },
  })

  const watchCompleted = Number(form.watch("quantity_completed")) || 0
  const watchRejected = Number(form.watch("quantity_rejected")) || 0
  const watchInput = Number(form.watch("quantity_input")) || 0
  const remaining = Math.max(0, totalQuantity - watchCompleted)
  const goodPieces = Math.max(0, watchCompleted - watchRejected)
  const wastePct = watchInput > 0 ? Math.round(((watchInput - watchCompleted) / watchInput) * 100) : 0

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

  if (!expanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs text-muted-foreground gap-1"
        onClick={() => setExpanded(true)}
      >
        <ChevronDown className="h-3.5 w-3.5" />
        Edit this stage
      </Button>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Live counters */}
      <div className="grid grid-cols-4 gap-2 rounded-lg bg-muted/50 p-3 text-center text-xs">
        <div>
          <p className="text-muted-foreground mb-0.5">Total</p>
          <p className="text-base font-bold tabular-nums">{totalQuantity}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Remaining</p>
          <p className={`text-base font-bold tabular-nums ${remaining > 0 ? "text-amber-600" : "text-emerald-600"}`}>
            {remaining}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Good Pieces</p>
          <p className="text-base font-bold tabular-nums text-emerald-600">{goodPieces}</p>
        </div>
        <div>
          <p className="text-muted-foreground mb-0.5">Waste %</p>
          <p className={`text-base font-bold tabular-nums ${wastePct > 10 ? "text-red-500" : wastePct > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
            {watchInput > 0 ? `${wastePct}%` : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Status */}
        <div className="col-span-2 sm:col-span-1 space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(v) => form.setValue("status", v as StageUpdateFormData["status"], { shouldValidate: true })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Qty Input (raw material input for this stage) */}
        <div className="space-y-1.5">
          <Label htmlFor={`input-${trackingId}`} className="text-xs">Qty Input <span className="text-muted-foreground">(raw)</span></Label>
          <Input
            id={`input-${trackingId}`}
            type="number"
            min={0}
            className="h-9"
            placeholder="0"
            {...form.register("quantity_input", { valueAsNumber: true })}
          />
        </div>

        {/* Qty Completed */}
        <div className="space-y-1.5">
          <Label htmlFor={`done-${trackingId}`} className="text-xs">
            Qty Completed <span className="text-muted-foreground">(of {totalQuantity})</span>
          </Label>
          <Input
            id={`done-${trackingId}`}
            type="number"
            min={0}
            max={totalQuantity}
            className="h-9"
            placeholder="0"
            {...form.register("quantity_completed", { valueAsNumber: true })}
          />
        </div>

        {/* Qty Rejected */}
        <div className="space-y-1.5">
          <Label htmlFor={`rej-${trackingId}`} className="text-xs">Qty Rejected</Label>
          <Input
            id={`rej-${trackingId}`}
            type="number"
            min={0}
            className="h-9"
            placeholder="0"
            {...form.register("quantity_rejected", { valueAsNumber: true })}
          />
        </div>
      </div>

      {/* Waste Notes */}
      <div className="space-y-1.5">
        <Label htmlFor={`waste-${trackingId}`} className="text-xs">Wastage Notes <span className="text-muted-foreground">(optional)</span></Label>
        <Input
          id={`waste-${trackingId}`}
          className="h-9"
          placeholder="e.g. Coating defect, welding error..."
          {...form.register("waste_notes")}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${trackingId}`} className="text-xs">Notes / Remarks</Label>
        <textarea
          id={`notes-${trackingId}`}
          className="flex min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="e.g. Machine issue, delay reason, shift notes..."
          {...form.register("notes")}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        {collapsed && (
          <Button type="button" variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setExpanded(false)}>
            <ChevronUp className="h-3.5 w-3.5" />
            Collapse
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting} size="sm" className="ml-auto">
          {isSubmitting ? "Saving..." : "Save Update"}
        </Button>
      </div>
    </form>
  )
}
