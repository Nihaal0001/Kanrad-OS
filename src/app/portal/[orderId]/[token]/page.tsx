import { notFound } from "next/navigation"
import { CheckCircle2, Clock, AlertCircle, Ban, Package, Truck } from "lucide-react"
import { verifyPortalToken } from "@/lib/portal"
import { createAdminClient } from "@/lib/supabase/admin"

interface Props {
  params: Promise<{ orderId: string; token: string }>
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  in_production: "In Production",
  completed: "Completed",
  dispatched: "Dispatched",
  cancelled: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  confirmed: "bg-blue-100 text-blue-700",
  in_production: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  dispatched: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-600",
}

const STAGE_ICON: Record<string, React.ElementType> = {
  pending: Clock,
  in_progress: AlertCircle,
  completed: CheckCircle2,
  blocked: Ban,
}

const STAGE_COLOR: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-amber-600",
  completed: "text-emerald-600",
  blocked: "text-red-500",
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
}

export default async function BuyerPortalPage({ params }: Props) {
  const { orderId, token } = await params

  // Verify token
  if (!verifyPortalToken(orderId, token)) notFound()

  // Fetch order data using admin client (no auth required for portal)
  const supabase = createAdminClient()
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, style_name, status, deadline, total_quantity,
      transporter_name, lr_number, vehicle_number, dispatch_date, expected_delivery_date,
      buyer:buyers(name, company),
      production_tracking(
        id, status, quantity_completed,
        stage:production_stages(id, name, sequence)
      )
    `)
    .eq("id", orderId)
    .single()

  if (error || !order) notFound()

  // Normalize
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buyer = Array.isArray((order as any).buyer) ? (order as any).buyer[0] : (order as any).buyer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tracking = ((order as any).production_tracking ?? [])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => ({ ...t, stage: Array.isArray(t.stage) ? t.stage[0] : t.stage }))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .sort((a: any, b: any) => (a.stage?.sequence ?? 0) - (b.stage?.sequence ?? 0))

  const completedStages = tracking.filter((t: { status: string }) => t.status === "completed").length
  const totalStages = tracking.length
  const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentStage = tracking.find((t: any) => t.status === "in_progress")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ?? tracking.find((t: any) => t.status === "pending")

  return (
    <div className="min-h-screen bg-[hsl(30,25%,97%)]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[hsl(25,18%,78%)] bg-white/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[hsl(25,20%,42%)]">JUST CLOTHING</p>
            <p className="text-sm font-semibold text-[hsl(25,20%,20%)]">Order Tracking Portal</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        {/* Order Card */}
        <div className="rounded-xl border border-[hsl(25,18%,72%)] bg-white shadow-[0_18px_45px_-32px_rgba(58,41,31,0.35)] p-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-[hsl(25,20%,45%)]">Order Reference</p>
          <h1 className="text-3xl font-bold text-[hsl(16,65%,55%)]">{order.order_number}</h1>
          <p className="mt-1 text-lg font-medium text-[hsl(25,20%,18%)]">{order.style_name}</p>
          {buyer && (
            <p className="mt-1 text-sm text-[hsl(25,16%,34%)]">{buyer.name}{buyer.company ? ` · ${buyer.company}` : ""}</p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[hsl(25,16%,82%)] pt-6">
            <div>
              <p className="text-xs font-medium text-[hsl(25,16%,40%)]">Total Quantity</p>
              <p className="text-xl font-bold tabular-nums text-[hsl(25,20%,18%)]">{order.total_quantity.toLocaleString("en-IN")}</p>
              <p className="text-xs text-[hsl(25,14%,42%)]">pieces</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(25,16%,40%)]">Deadline</p>
              <p className="font-semibold text-[hsl(25,20%,18%)]">{fmtDate(order.deadline)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-[hsl(25,16%,40%)]">Current Stage</p>
              <p className="font-semibold text-[hsl(25,20%,18%)]">{currentStage?.stage?.name ?? (order.status === "dispatched" ? "Dispatched" : "—")}</p>
            </div>
          </div>
        </div>

        {/* Production Progress */}
        {tracking.length > 0 && (
          <div className="rounded-xl border border-[hsl(25,18%,72%)] bg-white shadow-[0_18px_45px_-32px_rgba(58,41,31,0.35)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[hsl(25,20%,18%)]">Production Progress</h2>
              <span className="text-sm text-[hsl(25,16%,38%)]">{completedStages}/{totalStages} stages</span>
            </div>

            {/* Progress bar */}
            <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-6">
              <div
                className="h-full bg-[hsl(16,65%,55%)] rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            {/* Stage list */}
            <div className="space-y-2">
              {tracking.map((t: {
                id: string; status: string; quantity_completed: number
                stage: { id: string; name: string; sequence: number } | null
              }) => {
                const Icon = STAGE_ICON[t.status] ?? Clock
                return (
                  <div key={t.id} className="flex items-center gap-3 border-b border-[hsl(25,14%,88%)] py-2 last:border-0">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(30,20%,93%)] text-xs font-bold text-[hsl(25,18%,32%)]">
                      {t.stage?.sequence ?? "?"}
                    </span>
                    <span className="flex-1 text-sm text-[hsl(25,20%,18%)]">{t.stage?.name ?? "—"}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${STAGE_COLOR[t.status]}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {t.status === "in_progress" ? "In Progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Dispatch Info */}
        {order.status === "dispatched" && (order.transporter_name || order.lr_number || order.dispatch_date) && (
          <div className="rounded-xl border border-[hsl(25,18%,72%)] bg-white shadow-[0_18px_45px_-32px_rgba(58,41,31,0.35)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold text-emerald-700">Dispatched</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {order.transporter_name && (
                <div>
                  <p className="text-xs font-medium text-[hsl(25,16%,40%)]">Transporter</p>
                  <p className="font-medium text-[hsl(25,20%,18%)]">{order.transporter_name}</p>
                </div>
              )}
              {order.lr_number && (
                <div>
                  <p className="text-xs font-medium text-[hsl(25,16%,40%)]">LR Number</p>
                  <p className="font-mono font-medium text-[hsl(25,20%,18%)]">{order.lr_number}</p>
                </div>
              )}
              {order.vehicle_number && (
                <div>
                  <p className="text-xs font-medium text-[hsl(25,16%,40%)]">Vehicle</p>
                  <p className="font-mono font-medium text-[hsl(25,20%,18%)]">{order.vehicle_number}</p>
                </div>
              )}
              {order.dispatch_date && (
                <div>
                  <p className="text-xs font-medium text-[hsl(25,16%,40%)]">Dispatch Date</p>
                  <p className="font-medium text-[hsl(25,20%,18%)]">{fmtDate(order.dispatch_date)}</p>
                </div>
              )}
              {order.expected_delivery_date && (
                <div>
                  <p className="text-xs text-muted-foreground">Expected Delivery</p>
                  <p className="font-semibold text-emerald-700">{fmtDate(order.expected_delivery_date)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {order.status === "completed" && !order.dispatch_date && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-3">
            <Package className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-800">Order Complete</p>
              <p className="text-sm text-emerald-700">Your order is complete and ready for dispatch.</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="pt-4 text-center text-xs text-[hsl(25,14%,42%)]">
          This is a read-only view. For queries, contact JUST CLOTHING directly.
        </p>
      </main>
    </div>
  )
}
