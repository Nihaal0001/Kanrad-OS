"use client"

import Link from "next/link"
import { ClipboardEdit } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { Button } from "@/components/ui/button"

const STAGE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-secondary text-muted-foreground",
  in_progress: "bg-amber-100 text-amber-800 border-amber-300",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  blocked: "bg-red-100 text-red-800 border-red-300",
}

interface TrackingRow {
  id: string
  status: string
  quantity_completed: number
  quantity_rejected: number
  stage: { id: string; name: string; sequence: number }
}

interface OrderRow {
  id: string
  order_number: string
  product_variant: string
  total_quantity: number
  status: string
  deadline: string
  priority: string
  customer: { id: string; name: string; company: string | null } | null
  production_tracking: TrackingRow[]
}

interface PipelineViewProps {
  orders: OrderRow[]
  stageNames: string[]
}

export function PipelineView({ orders, stageNames }: PipelineViewProps) {
  if (orders.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border-2 border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          No active orders in production. Confirm an order to begin tracking.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stage header */}
      <div className="hidden lg:grid lg:grid-cols-[220px_repeat(7,_1fr)] gap-2 px-4">
        <div />
        {stageNames.map((name) => (
          <div key={name} className="text-center">
            <span className="text-xs font-medium text-muted-foreground leading-tight">
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Order rows */}
      <div className="space-y-2">
        {orders.map((order) => {
          // Build a map of stage sequence → tracking row
          const trackingBySeq: Record<number, TrackingRow> = {}
          order.production_tracking.forEach((t) => {
            trackingBySeq[t.stage.sequence] = t
          })

          return (
            <div
              key={order.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              {/* Order info */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Link
                  href={`/production/${order.id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline text-sm"
                >
                  {order.order_number}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {order.product_variant}
                </span>
                {order.customer && (
                  <span className="text-xs text-muted-foreground">
                    · {order.customer.name}
                  </span>
                )}
                <PriorityIndicator priority={order.priority} />
                <span className="text-xs text-muted-foreground">
                  Due {formatDate(order.deadline)}
                </span>
                <Button asChild size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1.5">
                  <Link href={`/production/${order.id}`}>
                    <ClipboardEdit className="h-3.5 w-3.5" />
                    Log Production
                  </Link>
                </Button>
              </div>

              {/* Stage pills */}
              <div className="flex flex-wrap gap-1.5 lg:grid lg:grid-cols-7">
                {Array.from({ length: 7 }, (_, i) => i + 1).map((seq) => {
                  const tracking = trackingBySeq[seq]
                  const stageName = stageNames[seq - 1] ?? `Stage ${seq}`
                  const status = tracking?.status ?? "pending"
                  const pct =
                    tracking && order.total_quantity > 0
                      ? Math.round(
                          (tracking.quantity_completed / order.total_quantity) * 100
                        )
                      : 0

                  return (
                    <div
                      key={seq}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-center text-xs transition-colors",
                        STAGE_STATUS_COLORS[status] ?? STAGE_STATUS_COLORS.pending
                      )}
                      title={`${stageName}: ${status}`}
                    >
                      <div className="font-medium truncate lg:hidden">
                        {stageName}
                      </div>
                      <div className="tabular-nums">
                        {status === "completed"
                          ? "✓"
                          : status === "blocked"
                          ? "✕"
                          : status === "in_progress"
                          ? `${pct}%`
                          : "—"}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-2 text-xs text-muted-foreground">
        {[
          { status: "pending", label: "Pending" },
          { status: "in_progress", label: "In Progress" },
          { status: "completed", label: "Completed" },
          { status: "blocked", label: "Blocked" },
        ].map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-block h-3 w-3 rounded border",
                STAGE_STATUS_COLORS[status]
              )}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
