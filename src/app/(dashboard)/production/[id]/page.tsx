import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"

import { getOrderProduction, getQualityChecks } from "@/actions/production"
import { formatDate, cn } from "@/lib/utils"
import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StatusBadge } from "@/components/shared/status-badge"
import { StageUpdateForm } from "@/components/production/stage-update-form"

interface ProductionDetailPageProps {
  params: Promise<{ id: string }>
}

const STAGE_STATUS_COLORS: Record<string, string> = {
  pending: "border-border text-muted-foreground",
  in_progress: "border-amber-300 bg-amber-50 text-amber-800",
  completed: "border-emerald-300 bg-emerald-50 text-emerald-800",
  blocked: "border-red-300 bg-red-50 text-red-800",
}

const STAGE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
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

  const qcChecks = await getQualityChecks({ order_id: id })

  const totalStages = order.production_tracking?.length ?? 0
  const completedStages =
    order.production_tracking?.filter((t: { status: string }) => t.status === "completed")
      .length ?? 0
  const progressPct =
    totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0

  return (
    <>
      <PageHeader
        title={order.order_number}
        description={`${order.style_name} · ${order.total_quantity} pcs`}
      >
        <Button variant="outline" asChild>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Progress summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Progress</span>
                <span className="text-sm text-muted-foreground">
                  {completedStages}/{totalStages} stages complete
                </span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </CardContent>
          </Card>

          {/* Stage cards */}
          <div className="space-y-3">
            {order.production_tracking?.map((tracking: {
              id: string
              status: string
              quantity_completed: number
              quantity_rejected: number
              notes: string | null
              started_at: string | null
              completed_at: string | null
              stage: { id: string; name: string; sequence: number; description: string | null }
            }) => {
              const pct =
                order.total_quantity > 0
                  ? Math.round(
                      (tracking.quantity_completed / order.total_quantity) * 100
                    )
                  : 0

              return (
                <div
                  key={tracking.id}
                  className={cn(
                    "rounded-lg border p-4",
                    STAGE_STATUS_COLORS[tracking.status]
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background border text-xs font-bold">
                        {tracking.stage.sequence}
                      </span>
                      <div>
                        <p className="font-medium">{tracking.stage.name}</p>
                        {tracking.stage.description && (
                          <p className="text-xs opacity-70">
                            {tracking.stage.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs capitalize">
                        {STAGE_STATUS_LABELS[tracking.status]}
                      </Badge>
                      <StageUpdateForm
                        trackingId={tracking.id}
                        orderId={id}
                        stageName={tracking.stage.name}
                        currentStatus={tracking.status}
                        currentQtyCompleted={tracking.quantity_completed}
                        currentQtyRejected={tracking.quantity_rejected}
                        currentNotes={tracking.notes}
                        totalQuantity={order.total_quantity}
                      />
                    </div>
                  </div>

                  {tracking.status !== "pending" && (
                    <div className="mt-3 grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="opacity-70">Completed</span>
                        <p className="font-medium tabular-nums">
                          {tracking.quantity_completed} pcs ({pct}%)
                        </p>
                      </div>
                      <div>
                        <span className="opacity-70">Rejected</span>
                        <p className="font-medium tabular-nums text-destructive">
                          {tracking.quantity_rejected} pcs
                        </p>
                      </div>
                      {tracking.started_at && (
                        <div>
                          <span className="opacity-70">
                            {tracking.completed_at ? "Completed" : "Started"}
                          </span>
                          <p className="font-medium">
                            {formatDate(
                              tracking.completed_at ?? tracking.started_at
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {tracking.notes && (
                    <p className="mt-2 text-xs opacity-70 italic">
                      {tracking.notes}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Buyer</p>
                <p className="font-medium">
                  {order.buyer?.name ?? "—"}
                  {order.buyer?.company && (
                    <span className="text-muted-foreground">
                      {" "}({order.buyer.company})
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p className="font-medium">{formatDate(order.deadline)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Quantity</p>
                <p className="font-medium">
                  {order.total_quantity.toLocaleString("en-IN")} pcs
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">
                  <StatusBadge status={order.status} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* QC summary */}
          <Card>
            <CardHeader>
              <CardTitle>QC Checks</CardTitle>
              <CardDescription>{qcChecks.length} total</CardDescription>
            </CardHeader>
            <CardContent>
              {qcChecks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No QC checks yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {qcChecks.slice(0, 5).map((check) => {
                    const passRate =
                      check.quantity_inspected > 0
                        ? Math.round(
                            (check.quantity_passed / check.quantity_inspected) *
                              100
                          )
                        : 0
                    return (
                      <div
                        key={check.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">
                          {formatDate(check.checked_at)}
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            passRate >= 95
                              ? "text-emerald-600"
                              : passRate >= 80
                              ? "text-amber-600"
                              : "text-destructive"
                          )}
                        >
                          {passRate}% pass
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                <Link href={`/production/${id}/qc`}>
                  <Plus className="h-3.5 w-3.5" />
                  Add QC Check
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
