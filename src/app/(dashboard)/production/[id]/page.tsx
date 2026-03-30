import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, CheckCircle2, Clock, Ban, AlertCircle } from "lucide-react"


import { getOrderProduction } from "@/actions/production"
import { formatDate, cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/status-badge"
import { StageInlineForm } from "@/components/production/stage-inline-form"

interface ProductionDetailPageProps {
  params: Promise<{ id: string }>
}

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: Clock,
  in_progress: AlertCircle,
  completed: CheckCircle2,
  blocked: Ban,
}

const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground",
  in_progress: "text-amber-500",
  completed: "text-emerald-500",
  blocked: "text-red-500",
}

const STATUS_CARD: Record<string, string> = {
  pending: "border-border bg-card",
  in_progress: "border-amber-300 bg-amber-50/60 dark:bg-amber-950/20",
  completed: "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20",
  blocked: "border-red-300 bg-red-50/60 dark:bg-red-950/20",
}

export default async function ProductionDetailPage({
  params,
}: ProductionDetailPageProps) {
  const { id } = await params

  let order
  try {
    order = await getOrderProduction(id)
  } catch {
    notFound()
  }

  const tracking = order.production_tracking ?? []
  const totalStages = tracking.length
  const completedStages = tracking.filter((t: { status: string }) => t.status === "completed").length
  const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

  const totalProduced = tracking.reduce((s: number, t: { quantity_completed: number }) => s + (t.quantity_completed ?? 0), 0)
  const totalRejected = tracking.reduce((s: number, t: { quantity_rejected: number }) => s + (t.quantity_rejected ?? 0), 0)
  const totalInput = tracking.reduce((s: number, t: { quantity_input?: number }) => s + (t.quantity_input ?? 0), 0)
  const totalWaste = Math.max(0, totalInput - totalProduced)
  const wastePct = totalInput > 0 ? Math.round((totalWaste / totalInput) * 100) : 0
  const currentStage = tracking.find((t: { status: string }) => t.status === "in_progress")
    ?? tracking.find((t: { status: string }) => t.status === "pending")

  return (
    <>
      <PageHeader
        title={order.order_number}
        description={`${order.product_variant} · ${order.total_quantity.toLocaleString("en-IN")} pcs`}
        breadcrumbs={[
          { label: "Production", href: "/production" },
          { label: order.order_number },
        ]}
      >
        <Button variant="outline" asChild className="hidden sm:inline-flex">
          <Link href="/production">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button asChild>
          <Link href={`/production/${id}/qc`}>
            <Plus className="h-4 w-4" />
            Add QC Check
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Left — stages */}
        <div className="lg:col-span-2 space-y-4">

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "Total Order", value: order.total_quantity, unit: "pcs", color: "" },
              { label: "Produced", value: totalProduced, unit: "pcs", color: "text-emerald-600" },
              { label: "Remaining", value: Math.max(0, order.total_quantity - totalProduced), unit: "pcs", color: "text-amber-600" },
              { label: "Rejected", value: totalRejected, unit: "pcs", color: "text-red-500" },
              { label: "Waste %", value: totalInput > 0 ? `${wastePct}%` : "—", unit: totalInput > 0 ? `${totalWaste} pcs wasted` : "no input logged", color: wastePct > 10 ? "text-red-500" : wastePct > 0 ? "text-amber-600" : "text-muted-foreground" },
            ].map((stat) => (
              <Card key={stat.label} className="text-center py-3">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={cn("text-2xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.unit}</p>
              </Card>
            ))}
          </div>

          {/* Progress bar */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="font-medium">Pipeline Progress</span>
                <span className="text-muted-foreground">{completedStages}/{totalStages} stages complete</span>
              </div>
              <Progress value={progressPct} className="h-3 rounded-full" />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>Raw Material Receipt</span>
                <span>{progressPct}%</span>
                <span>Packing</span>
              </div>
            </CardContent>
          </Card>

          {/* No stages yet */}
          {totalStages === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No production stages found. Make sure the order status is <strong>Confirmed</strong> and refresh the page.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Stage cards with inline forms */}
          <div className="space-y-3">
            {tracking.map((t: {
              id: string
              status: string
              quantity_completed: number
              quantity_rejected: number
              quantity_input?: number
              waste_notes?: string | null
              notes: string | null
              started_at: string | null
              completed_at: string | null
              stage: { id: string; name: string; sequence: number; description: string | null }
            }) => {
              const Icon = STATUS_ICON[t.status] ?? Clock
              const pct = order.total_quantity > 0
                ? Math.round((t.quantity_completed / order.total_quantity) * 100)
                : 0
              const isActive = t.status === "in_progress" || t.status === "pending"

              return (
                <Card key={t.id} className={cn("border-2 transition-colors", STATUS_CARD[t.status])}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background text-sm font-bold">
                          {t.stage.sequence}
                        </span>
                        <div>
                          <p className="font-semibold leading-tight">{t.stage.name}</p>
                          {t.stage.description && (
                            <p className="text-xs text-muted-foreground">{t.stage.description}</p>
                          )}
                        </div>
                      </div>
                      <div className={cn("flex items-center gap-1.5 text-sm font-medium shrink-0", STATUS_COLORS[t.status])}>
                        <Icon className="h-4 w-4" />
                        <span className="capitalize hidden sm:inline">
                          {t.status === "in_progress" ? "In Progress" : t.status.charAt(0).toUpperCase() + t.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    {/* Quick stats row (if any data) */}
                    {t.quantity_completed > 0 && (
                      <div className="ml-11 mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span><span className="font-semibold text-foreground">{t.quantity_completed}</span> produced ({pct}%)</span>
                        {t.quantity_rejected > 0 && (
                          <span><span className="font-semibold text-red-500">{t.quantity_rejected}</span> rejected</span>
                        )}
                        {t.quantity_input != null && t.quantity_input > 0 && (
                          <span>
                            <span className="font-semibold text-amber-600">
                              {Math.round(((t.quantity_input - t.quantity_completed) / t.quantity_input) * 100)}%
                            </span> waste ({t.quantity_input - t.quantity_completed} pcs)
                          </span>
                        )}
                        {t.started_at && (
                          <span>Started {formatDate(t.started_at)}</span>
                        )}
                        {t.completed_at && (
                          <span>Done {formatDate(t.completed_at)}</span>
                        )}
                      </div>
                    )}
                    {t.waste_notes && (
                      <p className="ml-11 mt-1 text-xs text-amber-700 dark:text-amber-400">Waste: {t.waste_notes}</p>
                    )}
                    {t.notes && (
                      <p className="ml-11 mt-1 text-xs italic text-muted-foreground">{t.notes}</p>
                    )}
                  </CardHeader>

                  {/* Inline update form — always visible for active stages */}
                  {isActive && (
                    <CardContent className="pt-0">
                      <div className="border-t pt-4">
                        <StageInlineForm
                          trackingId={t.id}
                          orderId={id}
                          stageName={t.stage.name}
                          currentStatus={t.status}
                          currentQtyCompleted={t.quantity_completed}
                          currentQtyRejected={t.quantity_rejected}
                          currentQtyInput={t.quantity_input}
                          currentWasteNotes={t.waste_notes}
                          currentNotes={t.notes}
                          totalQuantity={order.total_quantity}
                        />
                      </div>
                    </CardContent>
                  )}

                  {/* For completed/blocked — show edit button */}
                  {!isActive && (
                    <CardContent className="pt-0">
                      <div className="border-t pt-3">
                        <StageInlineForm
                          trackingId={t.id}
                          orderId={id}
                          stageName={t.stage.name}
                          currentStatus={t.status}
                          currentQtyCompleted={t.quantity_completed}
                          currentQtyRejected={t.quantity_rejected}
                          currentQtyInput={t.quantity_input}
                          currentWasteNotes={t.waste_notes}
                          currentNotes={t.notes}
                          totalQuantity={order.total_quantity}
                          collapsed
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{order.customer?.name ?? "—"}
                  {order.customer?.company && <span className="text-muted-foreground"> ({order.customer.company})</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium">{formatDate(order.deadline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Quantity</p>
                <p className="font-medium">{order.total_quantity.toLocaleString("en-IN")} pcs</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Stage</p>
                <p className="font-medium">{currentStage?.stage?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1"><StatusBadge status={order.status} /></div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  )
}
