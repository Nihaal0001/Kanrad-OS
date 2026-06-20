"use client"

import Link from "next/link"
import { ClipboardEdit } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { PriorityIndicator } from "@/components/shared/priority-indicator"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface OrderRow {
  id: string
  order_number: string
  product_variant: string
  total_quantity: number
  status: string
  deadline: string
  priority: string
  customer: { id: string; name: string; company: string | null } | null
  total_produced: number
  total_rejected: number
}

interface ProductionListProps {
  orders: OrderRow[]
}

export function ProductionList({ orders }: ProductionListProps) {
  if (orders.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border-2 border-dashed border-border">
        <p className="text-sm text-muted-foreground">
          No active orders in production. Confirm an order to begin logging output.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orders.map((order) => {
        const produced = order.total_produced
        const pct =
          order.total_quantity > 0
            ? Math.min(100, Math.round((produced / order.total_quantity) * 100))
            : 0
        const remaining = Math.max(0, order.total_quantity - produced)

        return (
          <div key={order.id} className="rounded-lg border border-border bg-card p-4">
            {/* Order info */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Link
                href={`/production/${order.id}`}
                className="font-medium text-primary underline-offset-4 hover:underline text-sm"
              >
                {order.order_number}
              </Link>
              <span className="text-sm text-muted-foreground">{order.product_variant}</span>
              {order.customer && (
                <span className="text-xs text-muted-foreground">· {order.customer.name}</span>
              )}
              <PriorityIndicator priority={order.priority} />
              <StatusBadge status={order.status} />
              <span className="text-xs text-muted-foreground">Due {formatDate(order.deadline)}</span>
              <Button asChild size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1.5">
                <Link href={`/production/${order.id}`}>
                  <ClipboardEdit className="h-3.5 w-3.5" />
                  Log Production
                </Link>
              </Button>
            </div>

            {/* Output progress */}
            <Progress value={pct} className="h-2.5 rounded-full" />
            <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <span>
                <span className="font-semibold text-emerald-600">{produced.toLocaleString("en-IN")}</span>
                {" / "}
                {order.total_quantity.toLocaleString("en-IN")} pcs produced ({pct}%)
              </span>
              <span>{remaining.toLocaleString("en-IN")} pcs remaining</span>
              {order.total_rejected > 0 && (
                <span className="text-red-500">{order.total_rejected.toLocaleString("en-IN")} rejected</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
