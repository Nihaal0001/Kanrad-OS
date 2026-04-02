"use client"

import { useState, useEffect, useTransition } from "react"
import { ChevronDown, CheckCircle2, Clock, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

import { getOrderProductionSummary, addDailyProduction } from "@/actions/production"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface OrderOption {
  id: string
  order_number: string
  product_variant: string
  total_quantity: number
  status: string
  customer: { id: string; name: string } | null
}

interface Props {
  orders: OrderOption[]
}

interface Summary {
  order: { id: string; order_number: string; product_variant: string; total_quantity: number; status: string }
  activeTracking: { id: string; quantity_completed: number; quantity_rejected: number; stage: { name: string; sequence: number } | null } | null
  totalProduced: number
  totalRejected: number
  pending: number
}

export function DailyProductionEntry({ orders }: Props) {
  const [selectedOrderId, setSelectedOrderId] = useState("")
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [qtyProduced, setQtyProduced] = useState("")
  const [qtyRejected, setQtyRejected] = useState("")
  const [notes, setNotes] = useState("")
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!selectedOrderId) {
      setSummary(null)
      return
    }
    setLoadingSummary(true)
    getOrderProductionSummary(selectedOrderId).then((s) => {
      setSummary(s)
      setLoadingSummary(false)
    }).catch(() => setLoadingSummary(false))
  }, [selectedOrderId])

  function handleSubmit() {
    if (!summary?.activeTracking) {
      toast.error("No active production stage found for this order")
      return
    }
    const produced = Number(qtyProduced)
    const rejected = Number(qtyRejected) || 0
    if (!qtyProduced || isNaN(produced) || produced <= 0) {
      toast.error("Enter a valid produced quantity")
      return
    }
    if (produced > summary.pending) {
      toast.error(`Cannot produce more than the pending quantity (${summary.pending})`)
      return
    }

    startTransition(async () => {
      const result = await addDailyProduction(
        selectedOrderId,
        summary.activeTracking!.id,
        produced,
        rejected,
        summary.activeTracking!.quantity_completed,
        summary.activeTracking!.quantity_rejected,
        notes || undefined
      )
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(`Recorded: ${produced} produced${rejected > 0 ? `, ${rejected} rejected` : ""}`)
      setQtyProduced("")
      setQtyRejected("")
      setNotes("")
      // Refresh summary
      const updated = await getOrderProductionSummary(selectedOrderId)
      setSummary(updated)
    })
  }

  const progressPct = summary
    ? Math.min(100, Math.round((summary.totalProduced / summary.order.total_quantity) * 100))
    : 0

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold">+</span>
          Daily Production Entry
        </CardTitle>
        <CardDescription>Select an order and record how many units were produced today.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Order selector */}
        <div className="space-y-1.5">
          <Label>Order</Label>
          <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select an active order…" />
            </SelectTrigger>
            <SelectContent>
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  <span className="font-mono text-xs mr-2">{o.order_number}</span>
                  <span>{o.product_variant}</span>
                  {o.customer && <span className="text-muted-foreground ml-1.5">· {o.customer.name}</span>}
                  <span className="text-muted-foreground ml-1.5">({o.total_quantity} pcs)</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Order summary */}
        {loadingSummary && (
          <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
        )}

        {summary && !loadingSummary && (
          <>
            {/* Progress bar */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold tabular-nums">{summary.order.total_quantity}</p>
                  <p className="text-xs text-muted-foreground">Total Order</p>
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums text-emerald-600">{summary.totalProduced}</p>
                  <p className="text-xs text-muted-foreground">Produced</p>
                </div>
                <div>
                  <p className={`text-xl font-bold tabular-nums ${summary.pending > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                    {summary.pending}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressPct === 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progressPct}% complete</span>
                  {summary.activeTracking?.stage && (
                    <span>Stage: {summary.activeTracking.stage.sequence}. {summary.activeTracking.stage.name}</span>
                  )}
                </div>
              </div>

              {summary.totalRejected > 0 && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {summary.totalRejected} rejected so far
                </p>
              )}

              {summary.pending === 0 && (
                <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Order fully produced
                </p>
              )}
            </div>

            {/* No active stage warning */}
            {!summary.activeTracking && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
                <Clock className="h-4 w-4 shrink-0" />
                No active production stage. Open the order detail to start a stage first.
              </div>
            )}

            {/* Entry form */}
            {summary.activeTracking && summary.pending > 0 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Produced Today (pcs) *</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={1}
                        max={summary.pending}
                        placeholder={`Max ${summary.pending}`}
                        className="pr-10"
                        value={qtyProduced}
                        onChange={(e) => setQtyProduced(e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">pcs</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rejected Today (pcs)</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        className="pr-10"
                        value={qtyRejected}
                        onChange={(e) => setQtyRejected(e.target.value)}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">pcs</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    placeholder="Any notes for today's production…"
                    rows={2}
                    className="resize-none"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <Button onClick={handleSubmit} disabled={isPending || !qtyProduced} className="w-full sm:w-auto">
                  {isPending ? "Saving…" : "Record Production"}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
